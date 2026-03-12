/**
 * Minimal Airtable API client for fetching Content and Raw Content records.
 * Uses the REST API directly — no SDK dependency needed.
 */

import { webEnv } from "@opencut/env/web";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

function getHeaders() {
	const apiKey = webEnv.AIRTABLE_API_KEY;
	if (!apiKey || apiKey === "placeholder") {
		throw new Error("AIRTABLE_API_KEY is not configured");
	}
	return {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	};
}

function getBaseUrl() {
	const baseId = webEnv.AIRTABLE_BASE_ID;
	if (!baseId || baseId === "placeholder") {
		throw new Error("AIRTABLE_BASE_ID is not configured");
	}
	return `${AIRTABLE_API_BASE}/${baseId}`;
}

export interface AirtableRecord<T = Record<string, unknown>> {
	id: string;
	fields: T;
	createdTime: string;
}

async function fetchRecord<T>({
	table,
	recordId,
}: {
	table: string;
	recordId: string;
}): Promise<AirtableRecord<T>> {
	const url = `${getBaseUrl()}/${encodeURIComponent(table)}/${recordId}`;
	const response = await fetch(url, { headers: getHeaders() });

	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`Airtable fetch failed (${response.status}): ${body}`,
		);
	}

	return response.json() as Promise<AirtableRecord<T>>;
}

async function updateRecord({
	table,
	recordId,
	fields,
}: {
	table: string;
	recordId: string;
	fields: Record<string, unknown>;
}): Promise<void> {
	const url = `${getBaseUrl()}/${encodeURIComponent(table)}/${recordId}`;
	const response = await fetch(url, {
		method: "PATCH",
		headers: getHeaders(),
		body: JSON.stringify({ fields }),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`Airtable update failed (${response.status}): ${body}`,
		);
	}
}

// --- Content record ---

export interface ContentFields {
	Hook?: string;
	"Hook Style"?: string; // Plain text name or JSON
	Format?: string[];     // Linked record IDs
	"Format (from Raw Content)"?: string[]; // Lookup field
	"Raw Content"?: string[]; // Linked record IDs
	"OpenCut Project ID"?: string;
	"Assigned Cutter"?: string;
	"Final Video"?: string; // Google Drive link to exported video
	Video?: string;         // Google Drive link to raw video copy
	"URL (from Raw Content)"?: string[]; // Lookup field
}

export async function fetchContentRecord({ recordId }: { recordId: string }) {
	return fetchRecord<ContentFields>({ table: "Content", recordId });
}

export async function updateContentRecord({
	recordId,
	fields,
}: {
	recordId: string;
	fields: Partial<ContentFields>;
}) {
	return updateRecord({ table: "Content", recordId, fields });
}

// --- Raw Content record ---

export interface RawContentFields {
	URL?: string;        // Google Drive link to raw video
	Duration?: number;
	Width?: number;
	Height?: number;
	FPS?: number;
}

export async function fetchRawContentRecord({ recordId }: { recordId: string }) {
	return fetchRecord<RawContentFields>({ table: "Raw Content", recordId });
}
