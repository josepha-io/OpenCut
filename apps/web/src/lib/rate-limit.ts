import { webEnv } from "@opencut/env/web";

let baseRateLimit: { limit: (key: string) => Promise<{ success: boolean }> } | null = null;

if (webEnv.UPSTASH_REDIS_REST_URL && webEnv.UPSTASH_REDIS_REST_TOKEN) {
	const { Ratelimit } = require("@upstash/ratelimit") as typeof import("@upstash/ratelimit");
	const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
	const redis = new Redis({
		url: webEnv.UPSTASH_REDIS_REST_URL,
		token: webEnv.UPSTASH_REDIS_REST_TOKEN,
	});
	baseRateLimit = new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(100, "1 m"),
		analytics: true,
		prefix: "rate-limit",
	});
}

export { baseRateLimit };

export async function checkRateLimit({ request }: { request: Request }) {
	if (!baseRateLimit) {
		return { success: true, limited: false };
	}
	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = await baseRateLimit.limit(ip);
	return { success, limited: !success };
}
