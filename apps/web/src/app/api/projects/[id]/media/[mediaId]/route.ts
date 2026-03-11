import { NextResponse, type NextRequest } from "next/server";
import { db, projects, projectMedia } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getRequiredSession } from "@/lib/auth/session";
import { getGCSBucket } from "@/lib/gcs/client";

type Params = { params: Promise<{ id: string; mediaId: string }> };

// DELETE /api/projects/:id/media/:mediaId — delete a media asset
export async function DELETE(_request: NextRequest, { params }: Params) {
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

	const [media] = await db
		.select()
		.from(projectMedia)
		.where(
			and(
				eq(projectMedia.id, mediaId),
				eq(projectMedia.projectId, projectId),
			),
		)
		.limit(1);

	if (!media) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	// Delete from GCS
	if (media.gcsPath) {
		try {
			await getGCSBucket().file(media.gcsPath).delete({ ignoreNotFound: true });
		} catch {
			// Non-fatal — metadata cleanup still proceeds
		}
	}

	await db
		.delete(projectMedia)
		.where(
			and(
				eq(projectMedia.id, mediaId),
				eq(projectMedia.projectId, projectId),
			),
		);

	return NextResponse.json({ deleted: true });
}
