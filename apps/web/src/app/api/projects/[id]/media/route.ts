import { NextResponse, type NextRequest } from "next/server";
import { db, projects, projectMedia } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getRequiredSession } from "@/lib/auth/session";
import { z } from "zod";
import { getMediaPath } from "@/lib/gcs/client";

type Params = { params: Promise<{ id: string }> };

async function verifyProjectAccess({
	projectId,
	userId,
	isAdmin,
}: {
	projectId: string;
	userId: string;
	isAdmin: boolean;
}) {
	const [project] = await db
		.select({ assignedUserId: projects.assignedUserId })
		.from(projects)
		.where(eq(projects.id, projectId))
		.limit(1);

	if (!project) return "not_found" as const;
	if (!isAdmin && project.assignedUserId !== userId)
		return "forbidden" as const;
	return "ok" as const;
}

// GET /api/projects/:id/media — list media for a project
export async function GET(_request: NextRequest, { params }: Params) {
	const session = await getRequiredSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id: projectId } = await params;
	const access = await verifyProjectAccess({
		projectId,
		userId: session.user.id,
		isAdmin: session.user.role === "admin",
	});

	if (access === "not_found") {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	if (access === "forbidden") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const rows = await db
		.select()
		.from(projectMedia)
		.where(eq(projectMedia.projectId, projectId));

	return NextResponse.json(rows);
}

const createMediaSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	type: z.enum(["image", "video", "audio"]),
	size: z.number().int().default(0),
	width: z.number().int().optional(),
	height: z.number().int().optional(),
	duration: z.number().int().optional(),
	fps: z.number().int().optional(),
});

// POST /api/projects/:id/media — register a media asset
export async function POST(request: NextRequest, { params }: Params) {
	const session = await getRequiredSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id: projectId } = await params;
	const access = await verifyProjectAccess({
		projectId,
		userId: session.user.id,
		isAdmin: session.user.role === "admin",
	});

	if (access === "not_found") {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	if (access === "forbidden") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const body = await request.json();
	const parsed = createMediaSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid request", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const gcsPath = getMediaPath({ projectId, mediaId: parsed.data.id });

	await db.insert(projectMedia).values({
		id: parsed.data.id,
		projectId,
		name: parsed.data.name,
		type: parsed.data.type,
		size: parsed.data.size,
		width: parsed.data.width,
		height: parsed.data.height,
		duration: parsed.data.duration,
		fps: parsed.data.fps,
		gcsPath,
	});

	return NextResponse.json({ id: parsed.data.id, gcsPath }, { status: 201 });
}
