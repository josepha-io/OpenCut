/**
 * Seed script to create sample projects for development/testing.
 * Projects are assigned to the first user found (or a specific user via --user-id).
 *
 * Usage:
 *   cd apps/web
 *   source .env.local
 *   bunx tsx scripts/seed-projects.ts [--user-id <id>] [--count <n>]
 */

import { db, projects, users } from "../src/lib/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
	const idx = args.indexOf(flag);
	return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const userIdArg = getArg("--user-id");
const countArg = Number(getArg("--count") ?? "6");

const SAMPLE_PROJECTS = [
	{ name: "Product Launch Video", status: "todo" as const, duration: 127 },
	{ name: "Customer Testimonial — Sarah K.", status: "todo" as const, duration: 245 },
	{ name: "Q1 Recap Reel", status: "done" as const, duration: 89 },
	{ name: "Instagram Story — Summer Sale", status: "todo" as const, duration: 15 },
	{ name: "Onboarding Tutorial Part 1", status: "done" as const, duration: 412 },
	{ name: "Brand Intro — 30s Cut", status: "todo" as const, duration: 30 },
	{ name: "Weekly Standup Recording", status: "done" as const, duration: 1803 },
	{ name: "App Feature Walkthrough", status: "todo" as const, duration: 186 },
	{ name: "Podcast Episode 12 — Highlights", status: "todo" as const, duration: 340 },
	{ name: "Holiday Campaign — Final Cut", status: "done" as const, duration: 60 },
];

const DEFAULT_PROJECT_DATA = {
	scenes: [],
	currentSceneId: "",
	settings: {
		fps: 30,
		canvasSize: { width: 1920, height: 1080 },
		background: { type: "color", color: "#000000" },
	},
	version: 1,
};

async function main() {
	// Resolve user ID
	let userId = userIdArg;
	if (!userId) {
		const [firstUser] = await db.select({ id: users.id }).from(users).limit(1);
		if (!firstUser) {
			console.error("No users found. Create a user first with: bunx tsx scripts/create-user.ts");
			process.exit(1);
		}
		userId = firstUser.id;
		console.log(`No --user-id specified, using first user: ${userId}`);
	} else {
		const [existingUser] = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		if (!existingUser) {
			console.error(`User ${userId} not found`);
			process.exit(1);
		}
	}

	const count = Math.min(countArg, SAMPLE_PROJECTS.length);
	const toInsert = SAMPLE_PROJECTS.slice(0, count);

	console.log(`\nSeeding ${count} projects for user ${userId}...\n`);

	for (const sample of toInsert) {
		const id = randomUUID();
		const now = new Date();
		// Stagger createdAt so sorting looks natural
		const createdAt = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
		const updatedAt = new Date(createdAt.getTime() + Math.random() * 2 * 24 * 60 * 60 * 1000);

		await db.insert(projects).values({
			id,
			name: sample.name,
			status: sample.status,
			assignedUserId: userId,
			duration: sample.duration,
			data: DEFAULT_PROJECT_DATA,
			createdAt,
			updatedAt,
		});

		const statusIcon = sample.status === "done" ? "✓" : "○";
		console.log(`  ${statusIcon} ${sample.name} (${sample.duration}s) [${sample.status}]`);
	}

	console.log(`\nDone — ${count} projects created.`);
	process.exit(0);
}

main().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
