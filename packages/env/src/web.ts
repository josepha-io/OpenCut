import { z } from "zod";

const webEnvSchema = z.object({
	// Node
	NODE_ENV: z.enum(["development", "production", "test"]),
	ANALYZE: z.string().optional(),
	NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),

	// Public
	NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
	NEXT_PUBLIC_MARBLE_API_URL: z.url(),
	NEXT_PUBLIC_USE_SERVER_STORAGE: z.string().optional(),

	// Server
	DATABASE_URL: z
		.string()
		.startsWith("postgres://")
		.or(z.string().startsWith("postgresql://")),

	BETTER_AUTH_SECRET: z.string(),
	UPSTASH_REDIS_REST_URL: z.url().optional(),
	UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
	MARBLE_WORKSPACE_KEY: z.string(),
	FREESOUND_CLIENT_ID: z.string(),
	FREESOUND_API_KEY: z.string(),
	CLOUDFLARE_ACCOUNT_ID: z.string(),
	R2_ACCESS_KEY_ID: z.string(),
	R2_SECRET_ACCESS_KEY: z.string(),
	R2_BUCKET_NAME: z.string(),
	MODAL_TRANSCRIPTION_URL: z.url(),

	// GCS Storage (optional — only needed for server-side project storage)
	GCS_BUCKET_NAME: z.string().optional(),
	GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

	// Webhook / Airtable (optional — only needed for auto project creation)
	WEBHOOK_AUTH_TOKEN: z.string().optional(),
	AIRTABLE_API_KEY: z.string().optional(),
	AIRTABLE_BASE_ID: z.string().optional(),

	// Google Drive export (optional — only needed for export-to-Drive flow)
	GOOGLE_DRIVE_EXPORT_FOLDER_ID: z.string().optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export const webEnv = webEnvSchema.parse(process.env);
