import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";

export async function getRequiredSession() {
	const reqHeaders = await headers();
	const cookie = reqHeaders.get("cookie");
	console.log("[auth] getRequiredSession: cookie present=%s, cookie preview=%s",
		!!cookie,
		cookie ? cookie.slice(0, 80) + "..." : "(none)",
	);

	const session = await auth.api.getSession({
		headers: reqHeaders,
	});

	if (!session) {
		console.log("[auth] No session found");
		return null;
	}

	console.log("[auth] Session found: userId=%s, role=%s, email=%s",
		session.user.id,
		session.user.role,
		session.user.email,
	);
	return session;
}
