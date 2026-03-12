import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { webEnv } from "@opencut/env/web";

let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
	if (!_db) {
		const connectionString = webEnv.DATABASE_URL;

		// Cloud SQL on Cloud Run uses Unix sockets at /cloudsql/CONNECTION_NAME
		// postgres.js needs the `host` option for Unix socket connections
		const socketMatch = connectionString.match(
			/\?host=(\/cloudsql\/[^\s&]+)/,
		);

		const client = socketMatch
			? postgres(connectionString.split("?")[0], {
					host: socketMatch[1],
				})
			: postgres(connectionString);

		_db = drizzle(client, { schema });
	}

	return _db;
}

export const db = getDb();

export * from "./schema";
