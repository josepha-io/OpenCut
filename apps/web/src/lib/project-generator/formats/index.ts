import type { FormatDefinition } from "./schema";
import { demoFormat } from "./demo";
import { tutorialFormat } from "./tutorial";

export type { FormatDefinition, HookPlacement, TextOverlayPlacement } from "./schema";

/**
 * Registry of all format definitions.
 * Add new formats here — they'll be available to the project generator
 * and webhook endpoint automatically.
 */
const FORMAT_REGISTRY: Record<string, FormatDefinition> = {
	demo: demoFormat,
	tutorial: tutorialFormat,
};

export function getFormatDefinition({
	format,
}: {
	format: string;
}): FormatDefinition | null {
	return FORMAT_REGISTRY[format.toLowerCase()] ?? null;
}

export function getAllFormats(): FormatDefinition[] {
	return Object.values(FORMAT_REGISTRY);
}

export function getFormatNames(): string[] {
	return Object.keys(FORMAT_REGISTRY);
}
