import { NextResponse, type NextRequest } from "next/server";
import { db, projects } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getRequiredSession } from "@/lib/auth/session";
import { z } from "zod";

// GET /api/projects — list projects for the logged-in user
export async function GET() {
	console.log("[projects] GET /api/projects");
	const session = await getRequiredSession();
	if (!session) {
		console.log("[projects] No session — returning 401");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	console.log("[projects] Authenticated: userId=%s, role=%s", session.user.id, session.user.role);

	const isAdmin = session.user.role === "admin";

	const rows = isAdmin
		? await db.select().from(projects)
		: await db
				.select()
				.from(projects)
				.where(eq(projects.assignedUserId, session.user.id));

	const result = rows.map((row) => ({
		id: row.id,
		name: row.name,
		status: row.status,
		assignedUserId: row.assignedUserId,
		thumbnail: row.thumbnail,
		duration: row.duration,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}));

	return NextResponse.json(result);
}

const createProjectSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	data: z.record(z.unknown()),
	assignedUserId: z.string().optional(),
	status: z.enum(["todo", "done"]).optional(),
});

// POST /api/projects — create a new project
export async function POST(request: NextRequest) {
	const session = await getRequiredSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json();
	const parsed = createProjectSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid request", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const { id, name, data, assignedUserId, status } = parsed.data;

	await db.insert(projects).values({
		id,
		name,
		data,
		assignedUserId: assignedUserId ?? session.user.id,
		status: status ?? "todo",
	});

	return NextResponse.json({ id }, { status: 201 });
}
