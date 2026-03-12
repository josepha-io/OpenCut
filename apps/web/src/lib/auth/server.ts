import { betterAuth, type RateLimit } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "@/lib/db";
import { webEnv } from "@opencut/env/web";

// DEBUG: log env vars that could be invalid URLs
console.log("[AUTH DEBUG] NEXT_PUBLIC_SITE_URL:", JSON.stringify(webEnv.NEXT_PUBLIC_SITE_URL));
console.log("[AUTH DEBUG] DATABASE_URL prefix:", webEnv.DATABASE_URL?.slice(0, 30));
console.log("[AUTH DEBUG] UPSTASH_REDIS_REST_URL:", JSON.stringify(webEnv.UPSTASH_REDIS_REST_URL));

function buildRateLimitConfig() {
	if (!webEnv.UPSTASH_REDIS_REST_URL || !webEnv.UPSTASH_REDIS_REST_TOKEN) {
		return {};
	}
	// Dynamic import to avoid requiring @upstash/redis when not configured
	const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
	const redis = new Redis({
		url: webEnv.UPSTASH_REDIS_REST_URL,
		token: webEnv.UPSTASH_REDIS_REST_TOKEN,
	});
	return {
		rateLimit: {
			storage: "secondary-storage" as const,
			customStorage: {
				get: async (key: string) => {
					const value = await redis.get(key);
					return value as RateLimit | undefined;
				},
				set: async (key: string, value: RateLimit) => {
					await redis.set(key, value);
				},
			},
		},
	};
}

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		usePlural: true,
	}),
	secret: webEnv.BETTER_AUTH_SECRET,
	user: {
		deleteUser: {
			enabled: true,
		},
	},
	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
	},
	...buildRateLimitConfig(),
	baseURL: webEnv.NEXT_PUBLIC_SITE_URL,
	appName: "OpenCut",
	trustedOrigins: [webEnv.NEXT_PUBLIC_SITE_URL],
	plugins: [admin()],
});

export type Auth = typeof auth;
