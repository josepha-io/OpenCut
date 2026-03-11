import { NextResponse, type NextRequest } from "next/server";
import { db, projects } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getRequiredSession } from "@/lib/auth/session";
import { getGCSBucket, getMediaPath } from "@/lib/gcs/client";
import { z } from "zod";

type Params = { params: Promise<{ id: string; mediaId: string }> };

const uploadUrlSchema = z.object({
	contentType: z.string().min(1),
});

// POST /api/projects/:id/media/:mediaId/upload-url — get a signed upload URL
export async function POST(request: NextRequest, { params }: Params) {
	const session = await getRequiredSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id: projectId, mediaId } = await params;

	const [project] = await db
		.select({ assignedUserId: projects.assignedUserId })
		.from(projects)
		.where(eq(projects.id, projectId))
		.limit(1);

	if (!project) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const isAdmin = session.user.role === "admin";
	if (!isAdmin && project.assignedUserId !== session.user.id) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const body = await request.json();
	const parsed = uploadUrlSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid request", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const gcsPath = getMediaPath({ projectId, mediaId });
	const file = getGCSBucket().file(gcsPath);

	const [url] = await file.getSignedUrl({
		version: "v4",
		action: "write",
		expires: Date.now() + 15 * 60 * 1000,
		contentType: parsed.data.contentType,
	});

	return NextResponse.json({ url, gcsPath });
}
