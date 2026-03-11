/**
 * Admin script to create user accounts (invite-only flow).
 * Uses Better Auth's internal adapter for proper password hashing (scrypt).
 *
 * Usage:
 *   cd apps/web
 *   source .env.local  # ensure DATABASE_URL etc. are set
 *   bunx tsx scripts/create-user.ts --email cutter@example.com --name "Jane Doe" --password "securepassword" [--role admin]
 */

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
	const idx = args.indexOf(flag);
	return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const emailArg = getArg("--email");
const nameArg = getArg("--name");
const passwordArg = getArg("--password");
const roleArg = getArg("--role") ?? "user";

if (!emailArg || !nameArg || !passwordArg) {
	console.error(
		"Usage: bunx tsx scripts/create-user.ts --email <email> --name <name> --password <password> [--role admin|user]",
	);
	process.exit(1);
}

async function main() {
	const { auth } = await import("../src/lib/auth/server");

	const ctx = await auth.$context;
	const hashedPassword = await ctx.password.hash(passwordArg!);

	const user = await ctx.internalAdapter.createUser({
		email: emailArg!,
		name: nameArg!,
		emailVerified: true,
		role: roleArg,
	});

	if (!user) {
		console.error("Failed to create user");
		process.exit(1);
	}

	await ctx.internalAdapter.linkAccount({
		userId: user.id,
		accountId: user.id,
		providerId: "credential",
		password: hashedPassword,
	});

	console.log("User created successfully:");
	console.log(`  ID:    ${user.id}`);
	console.log(`  Name:  ${nameArg}`);
	console.log(`  Email: ${emailArg}`);
	console.log(`  Role:  ${roleArg}`);

	process.exit(0);
}

main().catch((err) => {
	console.error("Failed to create user:", err);
	process.exit(1);
});
