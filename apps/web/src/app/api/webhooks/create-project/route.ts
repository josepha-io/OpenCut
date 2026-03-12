/**
 * POST /api/webhooks/create-project
 *
 * Creates an OpenCut project from Airtable Content data.
 * Called either by:
 *   - The posting-bot hooks_server.py after /hooks/cut-content creates a Content record
 *   - An Airtable automation when Content.hook is set
 *
 * Integration (Option A — chain in hooks_server.py):
 *   After creating the Content record, add:
 *     requests.post(
 *       f"{OPENCUT_URL}/api/webhooks/create-project",
 *       json={"mode": "airtable", "contentId": content_record_id},
 *       headers={"Authorization": f"Bearer {OPENCUT_WEBHOOK_TOKEN}"},
 *     )
 *
 * Integration (Option B — Airtable automation):
 *   Trigger: When record matches conditions in Content table (hook is not empty)
 *   Action: Send webhook POST to {OPENCUT_URL}/api/webhooks/create-project
 *   Body: {"mode": "airtable", "contentId": "{Record ID}"}
 *   Headers: Authorization: Bearer {OPENCUT_WEBHOOK_TOKEN}
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db, projects, projectMedia, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { webEnv } from "@opencut/env/web";
import { getGCSBucket, getMediaPath } from "@/lib/gcs/client";
import {
	generateProject,
	generateProjectFromFormat,
	getFormatDefinition,
} from "@/lib/project-generator";
import {
	fetchContentRecord,
	fetchRawContentRecord,
	updateContentRecord,
} from "@/lib/airtable/client";

// --- Auth ---

function verifyWebhookAuth(request: NextRequest): boolean {
	const token = webEnv.WEBHOOK_AUTH_TOKEN;
	if (!token) return false;

	const authHeader = request.headers.get("authorization");
	if (!authHeader) return false;

	const [scheme, value] = authHeader.split(" ");
	return scheme === "Bearer" && value === token;
}

// --- Google Drive helpers ---

function extractDriveFileId(driveLink: string): string | null {
	// Handles: /file/d/FILE_ID/..., /open?id=FILE_ID, id=FILE_ID
	const patterns = [
		/\/file\/d\/([a-zA-Z0-9_-]+)/,
		/[?&]id=([a-zA-Z0-9_-]+)/,
	];
	for (const pattern of patterns) {
		const match = driveLink.match(pattern);
		if (match) return match[1];
	}
	return null;
}

/**
 * Get an OAuth2 access token for Google APIs.
 * - If GOOGLE_APPLICATION_CREDENTIALS is set: uses service account key file (local dev)
 * - Otherwise: uses Application Default Credentials via metadata server (Cloud Run)
 */
async function getServiceAccountToken(
	scope = "https://www.googleapis.com/auth/drive.readonly",
): Promise<string> {
	const keyPath = webEnv.GOOGLE_APPLICATION_CREDENTIALS;

	if (keyPath) {
		// Local dev: use key file
		const fs = await import("node:fs");
		const crypto = await import("node:crypto");
		const keyFile = JSON.parse(fs.readFileSync(keyPath, "utf-8"));

		const now = Math.floor(Date.now() / 1000);
		const header = Buffer.from(
			JSON.stringify({ alg: "RS256", typ: "JWT" }),
		).toString("base64url");
		const payload = Buffer.from(
			JSON.stringify({
				iss: keyFile.client_email,
				scope,
				aud: "https://oauth2.googleapis.com/token",
				iat: now,
				exp: now + 3600,
			}),
		).toString("base64url");

		const signature = crypto
			.sign(
				"sha256",
				Buffer.from(`${header}.${payload}`),
				keyFile.private_key,
			)
			.toString("base64url");

		const jwt = `${header}.${payload}.${signature}`;

		const tokenResponse = await fetch(
			"https://oauth2.googleapis.com/token",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
			},
		);

		if (!tokenResponse.ok) {
			throw new Error(
				`Token exchange failed: ${await tokenResponse.text()}`,
			);
		}

		const { access_token } = (await tokenResponse.json()) as {
			access_token: string;
		};
		return access_token;
	}

	// Cloud Run: use metadata server for ADC
	console.log("[webhook] Using metadata server for access token");
	const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token`;
	const response = await fetch(metadataUrl, {
		headers: { "Metadata-Flavor": "Google" },
	});

	if (!response.ok) {
		throw new Error(
			`Metadata token fetch failed (${response.status}): ${await response.text()}`,
		);
	}

	const { access_token } = (await response.json()) as {
		access_token: string;
	};
	return access_token;
}

async function downloadFromGoogleDrive({
	fileId,
}: {
	fileId: string;
}): Promise<{ buffer: Buffer; contentType: string }> {
	const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
	const token = await getServiceAccountToken();

	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${token}` },
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`Google Drive download failed (${response.status}): ${body}`,
		);
	}

	const contentType =
		response.headers.get("content-type") || "video/mp4";
	const arrayBuffer = await response.arrayBuffer();
	return { buffer: Buffer.from(arrayBuffer), contentType };
}

// --- Request schema ---

/**
 * The webhook accepts either:
 * A) `contentId` only → fetches everything from Airtable
 * B) Full payload with all data inline (for testing / non-Airtable callers)
 */
const webhookSchema = z.discriminatedUnion("mode", [
	z.object({
		mode: z.literal("airtable"),
		contentId: z.string().min(1),
		/** Assign to this user. Falls back to Airtable assigned_cutter_id lookup. */
		assignToUserId: z.string().optional(),
	}),
	z.object({
		mode: z.literal("inline"),
		contentId: z.string().min(1),
		format: z.string().min(1),
		driveLink: z.string().min(1),
		videoDuration: z.number().positive(),
		videoWidth: z.number().int().positive().optional(),
		videoHeight: z.number().int().positive().optional(),
		hook: z.string().optional(),
		hookStyle: z.record(z.unknown()).optional(),
		hookDuration: z.number().positive().optional(),
		hookStartTime: z.number().min(0).optional(),
		textOverlays: z
			.array(
				z.object({
					content: z.string(),
					startTime: z.number().min(0),
					endTime: z.number().positive(),
					style: z.record(z.unknown()).optional(),
				}),
			)
			.optional(),
		assignToUserId: z.string().optional(),
		canvasWidth: z.number().int().positive().optional(),
		canvasHeight: z.number().int().positive().optional(),
		fps: z.number().int().positive().optional(),
		/** Field values for format-defined text overlays (e.g. { cta_text: "Shop now" }) */
		fieldValues: z.record(z.string()).optional(),
	}),
]);

// --- Main handler ---

export async function POST(request: NextRequest) {
	console.log("[webhook] POST /api/webhooks/create-project");

	// 1. Auth
	if (!verifyWebhookAuth(request)) {
		console.log("[webhook] Auth failed");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// 2. Parse
	const body = await request.json();
	console.log("[webhook] Request body:", JSON.stringify(body));
	const parsed = webhookSchema.safeParse(body);
	if (!parsed.success) {
		console.log("[webhook] Validation failed:", JSON.stringify(parsed.error.flatten()));
		return NextResponse.json(
			{ error: "Invalid request", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const data = parsed.data;

	try {
		console.log("[webhook] Mode:", data.mode, "contentId:", data.contentId);
		// 3. Resolve input data
		let contentId: string;
		let format: string;
		let driveLink: string;
		let videoDuration: number;
		let videoWidth: number | undefined;
		let videoHeight: number | undefined;
		let hook: string | undefined;
		let hookStyle: Record<string, unknown> | undefined;
		let hookDuration: number | undefined;
		let hookStartTime: number | undefined;
		let textOverlays: Array<{
			content: string;
			startTime: number;
			endTime: number;
			style?: Record<string, unknown>;
		}> | undefined;
		let assignToUserId: string | undefined;
		let canvasWidth: number | undefined;
		let canvasHeight: number | undefined;
		let fps: number | undefined;

		if (data.mode === "airtable") {
			// Fetch from Airtable
			console.log("[webhook] Fetching Content record:", data.contentId);
			const contentRecord = await fetchContentRecord({
				recordId: data.contentId,
			});
			const fields = contentRecord.fields;
			console.log("[webhook] Content fields:", JSON.stringify(fields));

			// Idempotency: skip if already created
			if (fields["OpenCut Project ID"]) {
				return NextResponse.json({
					message: "Project already exists",
					projectId: fields["OpenCut Project ID"],
					skipped: true,
				});
			}

			// Get raw content for video info
			const rawContentId = fields["Raw Content"]?.[0];
			if (!rawContentId) {
				return NextResponse.json(
					{ error: "Content record has no linked Raw Content" },
					{ status: 400 },
				);
			}

			console.log("[webhook] Fetching Raw Content record:", rawContentId);
			const rawContentRecord = await fetchRawContentRecord({
				recordId: rawContentId,
			});
			const rawFields = rawContentRecord.fields;
			console.log("[webhook] Raw Content fields:", JSON.stringify(rawFields));

			if (!rawFields.URL) {
				return NextResponse.json(
					{ error: "Raw Content has no URL" },
					{ status: 400 },
				);
			}

			contentId = data.contentId;
			// Format lookup field from Airtable
			const formatArr = fields["Format (from Raw Content)"];
			format = (Array.isArray(formatArr) ? formatArr[0] : formatArr) ?? "video";
			// Prefer the Video field (copy in editing folder) over raw content URL
			driveLink = fields.Video || rawFields.URL;
			if (!driveLink) {
				return NextResponse.json(
					{ error: "No video URL found (checked Video and Raw Content URL)" },
					{ status: 400 },
				);
			}
			console.log("[webhook] Using drive link from: %s", fields.Video ? "Content.Video" : "RawContent.URL");
			videoDuration = rawFields.Duration ?? 0;
			videoWidth = rawFields.Width ?? 1080;
			videoHeight = rawFields.Height ?? 1920;
			hook = fields.Hook;
			if (fields["Hook Style"]) {
				try {
					hookStyle = JSON.parse(fields["Hook Style"]);
				} catch {
					// Hook Style is a plain text name, not JSON — ignore it
					console.log("[webhook] Hook Style is not JSON, ignoring:", fields["Hook Style"]);
				}
			}
			assignToUserId = data.assignToUserId;
		} else {
			// Inline mode
			contentId = data.contentId;
			format = data.format;
			driveLink = data.driveLink;
			videoDuration = data.videoDuration;
			videoWidth = data.videoWidth;
			videoHeight = data.videoHeight;
			hook = data.hook;
			hookStyle = data.hookStyle;
			hookDuration = data.hookDuration;
			hookStartTime = data.hookStartTime;
			textOverlays = data.textOverlays as typeof textOverlays;
			assignToUserId = data.assignToUserId;
			canvasWidth = data.canvasWidth;
			canvasHeight = data.canvasHeight;
			fps = data.fps;
		}

		console.log("[webhook] Resolved: format=%s, driveLink=%s, duration=%s, hook=%s", format, driveLink, videoDuration, hook?.slice(0, 50));

		// 4. Extract Drive file ID
		const driveFileId = extractDriveFileId(driveLink);
		if (!driveFileId) {
			console.log("[webhook] Could not extract file ID from driveLink:", driveLink);
			return NextResponse.json(
				{ error: "Could not extract file ID from drive_link" },
				{ status: 400 },
			);
		}
		console.log("[webhook] Drive file ID:", driveFileId);

		// 5. Generate project — use format definition if available
		const formatDef = getFormatDefinition({ format });
		const fieldValues =
			data.mode === "inline" ? data.fieldValues : undefined;

		const { project, mediaId } = formatDef
			? generateProjectFromFormat({
					contentId,
					formatDef,
					hook,
					videoDuration,
					driveLink,
					fieldValues,
				})
			: generateProject({
					content: {
						contentId,
						format,
						hook,
						hookStyle: hookStyle as any,
						hookDuration,
						hookStartTime,
						textOverlays: textOverlays as any,
					},
					rawContent: {
						driveLink,
						duration: videoDuration,
						width: videoWidth,
						height: videoHeight,
					},
					formatConfig:
						canvasWidth && canvasHeight
							? { canvasSize: { width: canvasWidth, height: canvasHeight }, fps }
							: fps
								? { fps }
								: undefined,
				});

		// 6. Resolve assigned user
		let resolvedUserId = assignToUserId;
		if (!resolvedUserId) {
			// Fall back to first user (dev convenience)
			const [firstUser] = await db
				.select({ id: users.id })
				.from(users)
				.limit(1);
			resolvedUserId = firstUser?.id;
		}

		// 7. Insert project into DB
		const projectData = {
			scenes: project.scenes,
			currentSceneId: project.currentSceneId,
			settings: project.settings,
			version: project.version,
		};

		console.log("[webhook] Inserting project into DB: id=%s name=%s assignedTo=%s", project.metadata.id, project.metadata.name, resolvedUserId);
		await db.insert(projects).values({
			id: project.metadata.id,
			name: project.metadata.name,
			status: "todo",
			assignedUserId: resolvedUserId ?? null,
			duration: project.metadata.duration,
			data: projectData,
			createdAt: new Date(project.metadata.createdAt),
			updatedAt: new Date(project.metadata.updatedAt),
		});
		console.log("[webhook] Project inserted into DB");

		// 8. Download video from Google Drive
		let videoUploaded = false;
		try {
			console.log("[webhook] Downloading video from Drive: fileId=%s", driveFileId);
			const { buffer, contentType } = await downloadFromGoogleDrive({
				fileId: driveFileId,
			});
			console.log("[webhook] Downloaded %d bytes, contentType=%s", buffer.length, contentType);

			// 9. Upload to GCS
			const gcsPath = getMediaPath({
				projectId: project.metadata.id,
				mediaId,
			});
			const bucket = getGCSBucket();
			const file = bucket.file(gcsPath);

			await file.save(buffer, {
				contentType,
				resumable: buffer.length > 5 * 1024 * 1024,
			});

			// 10. Register media in DB
			await db.insert(projectMedia).values({
				id: mediaId,
				projectId: project.metadata.id,
				name: `${format}_video`,
				type: "video",
				size: buffer.length,
				width: videoWidth ?? null,
				height: videoHeight ?? null,
				duration: Math.round(videoDuration),
				gcsPath,
			});

			videoUploaded = true;
			console.log("[webhook] Video uploaded to GCS and registered in DB");
		} catch (err) {
			// Video download/upload failed — project is created but without media
			console.error("[webhook] Video transfer failed:", err);
		}

		// 11. Update Airtable if in airtable mode (best-effort, field may not exist yet)
		if (data.mode === "airtable") {
			try {
				await updateContentRecord({
					recordId: contentId,
					fields: { "OpenCut Project ID": project.metadata.id },
				});
				console.log("[webhook] Airtable Content record updated with project ID");
			} catch (err) {
				// Field may not exist in Airtable yet — non-fatal
				console.warn("[webhook] Failed to update Airtable (non-fatal):", err instanceof Error ? err.message : err);
			}
		}

		return NextResponse.json(
			{
				projectId: project.metadata.id,
				mediaId,
				videoUploaded,
				name: project.metadata.name,
			},
			{ status: 201 },
		);
	} catch (err) {
		console.error("[webhook] create-project failed:", err);
		return NextResponse.json(
			{
				error: "Internal server error",
				message: err instanceof Error ? err.message : String(err),
			},
			{ status: 500 },
		);
	}
}
