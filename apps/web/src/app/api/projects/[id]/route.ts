import { NextResponse, type NextRequest } from "next/server";
import { db, projects } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getRequiredSession } from "@/lib/auth/session";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/:id — load full project
export async function GET(_request: NextRequest, { params }: Params) {
	const session = await getRequiredSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;
	const [row] = await db
		.select()
		.from(projects)
		.where(eq(projects.id, id))
		.limit(1);

	if (!row) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const isAdmin = session.user.role === "admin";
	if (!isAdmin && row.assignedUserId !== session.user.id) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	return NextResponse.json({
		id: row.id,
		name: row.name,
		status: row.status,
		assignedUserId: row.assignedUserId,
		thumbnail: row.thumbnail,
		duration: row.duration,
		data: row.data,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	});
}

const updateProjectSchema = z.object({
	name: z.string().min(1).optional(),
	data: z.record(z.unknown()).optional(),
	status: z.enum(["todo", "done"]).optional(),
	thumbnail: z.string().nullable().optional(),
	duration: z.number().int().optional(),
});

// PUT /api/projects/:id — save/update project
export async function PUT(request: NextRequest, { params }: Params) {
	const session = await getRequiredSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;

	const [existing] = await db
		.select({ assignedUserId: projects.assignedUserId })
		.from(projects)
		.where(eq(projects.id, id))
		.limit(1);

	if (!existing) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const isAdmin = session.user.role === "admin";
	if (!isAdmin && existing.assignedUserId !== session.user.id) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const body = await request.json();
	const parsed = updateProjectSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid request", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (parsed.data.name !== undefined) updates.name = parsed.data.name;
	if (parsed.data.data !== undefined) updates.data = parsed.data.data;
	if (parsed.data.status !== undefined) updates.status = parsed.data.status;
	if (parsed.data.thumbnail !== undefined)
		updates.thumbnail = parsed.data.thumbnail;
	if (parsed.data.duration !== undefined)
		updates.duration = parsed.data.duration;

	await db.update(projects).set(updates).where(eq(projects.id, id));

	return NextResponse.json({ id });
}

// DELETE /api/projects/:id — delete project
export async function DELETE(_request: NextRequest, { params }: Params) {
	const session = await getRequiredSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;

	const [existing] = await db
		.select({ assignedUserId: projects.assignedUserId })
		.from(projects)
		.where(eq(projects.id, id))
		.limit(1);

	if (!existing) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const isAdmin = session.user.role === "admin";
	if (!isAdmin && existing.assignedUserId !== session.user.id) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	await db.delete(projects).where(eq(projects.id, id));

	return NextResponse.json({ deleted: true });
}
