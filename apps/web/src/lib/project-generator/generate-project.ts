/**
 * Generates a valid TProject JSON (version 9) from Airtable Content data.
 *
 * The output can be saved directly via ServerStorageService or inserted into
 * the projects table as the `data` JSONB column.
 */

import { randomUUID } from "node:crypto";
import type {
	GenerateProjectInput,
	TextOverlayStyle,
} from "./types";
import type { FormatDefinition, TextOverlayPlacement } from "./formats/schema";

/** Current OpenCut project version */
const PROJECT_VERSION = 9;

const DEFAULT_CANVAS = { width: 1080, height: 1920 };
const DEFAULT_FPS = 30;

const DEFAULT_TEXT_STYLE: Required<
	Omit<TextOverlayStyle, "positionX" | "positionY" | "scale">
> & { positionX: number; positionY: number; scale: number } = {
	fontSize: 48,
	fontFamily: "Inter",
	color: "#ffffff",
	fontWeight: "bold",
	fontStyle: "normal",
	textAlign: "center",
	background: {
		enabled: false,
		color: "transparent",
		cornerRadius: 0,
		paddingX: 0,
		paddingY: 0,
	},
	positionX: 0.5,
	positionY: 0.5,
	scale: 1,
};

function mergeStyle(override?: TextOverlayStyle) {
	if (!override) return DEFAULT_TEXT_STYLE;
	return {
		...DEFAULT_TEXT_STYLE,
		...override,
		background: {
			...DEFAULT_TEXT_STYLE.background,
			...override.background,
		},
	};
}

/**
 * Convert fractional position (0-1) to pixel offset from center.
 * OpenCut positions are relative to canvas center (0,0 = center).
 */
function toCanvasPosition({
	fracX,
	fracY,
	canvasWidth,
	canvasHeight,
}: {
	fracX: number;
	fracY: number;
	canvasWidth: number;
	canvasHeight: number;
}) {
	return {
		x: (fracX - 0.5) * canvasWidth,
		y: (fracY - 0.5) * canvasHeight,
	};
}

function buildVideoElement({
	mediaId,
	duration,
}: {
	mediaId: string;
	duration: number;
}) {
	return {
		id: randomUUID(),
		name: "Video",
		type: "video" as const,
		mediaId,
		duration,
		startTime: 0,
		trimStart: 0,
		trimEnd: duration,
		sourceDuration: duration,
		transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
		opacity: 1,
	};
}

function buildTextElement({
	content,
	startTime,
	endTime,
	style,
	canvasWidth,
	canvasHeight,
}: {
	content: string;
	startTime: number;
	endTime: number;
	style: TextOverlayStyle | undefined;
	canvasWidth: number;
	canvasHeight: number;
}) {
	const s = mergeStyle(style);
	const duration = Math.max(0, endTime - startTime);
	const position = toCanvasPosition({
		fracX: s.positionX,
		fracY: s.positionY,
		canvasWidth,
		canvasHeight,
	});

	return {
		id: randomUUID(),
		name: content.slice(0, 30),
		type: "text" as const,
		content,
		duration,
		startTime,
		trimStart: 0,
		trimEnd: duration,
		fontSize: s.fontSize,
		fontFamily: s.fontFamily,
		color: s.color,
		background: {
			enabled: s.background.enabled ?? false,
			color: s.background.color ?? "transparent",
			cornerRadius: s.background.cornerRadius ?? 0,
			paddingX: s.background.paddingX ?? 0,
			paddingY: s.background.paddingY ?? 0,
		},
		textAlign: s.textAlign,
		fontWeight: s.fontWeight,
		fontStyle: s.fontStyle,
		textDecoration: "none" as const,
		transform: {
			scale: s.scale ?? 1,
			position,
			rotate: 0,
		},
		opacity: 1,
		hidden: false,
	};
}

function buildTextTrack({
	name,
	elements,
}: {
	name: string;
	elements: ReturnType<typeof buildTextElement>[];
}) {
	return {
		id: randomUUID(),
		name,
		type: "text" as const,
		elements,
		hidden: false,
	};
}

/**
 * Generate a complete TProject-compatible JSON from Airtable Content data.
 *
 * Returns a plain object matching the SerializedProject shape
 * (dates as ISO strings) ready for DB insertion or API response.
 */
export function generateProject({ content, rawContent, formatConfig }: GenerateProjectInput) {
	const canvasSize = formatConfig?.canvasSize ?? DEFAULT_CANVAS;
	const fps = formatConfig?.fps ?? DEFAULT_FPS;
	const videoDuration = rawContent.duration;

	// IDs
	const projectId = randomUUID();
	const sceneId = randomUUID();
	const mediaId = randomUUID();

	// Build project name: format_date_contentId
	const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const projectName = `${content.format}_${dateStr}_${content.contentId}`;

	// --- Video track ---
	const videoElement = buildVideoElement({ mediaId, duration: videoDuration });
	const videoTrack = {
		id: randomUUID(),
		name: "Main Video",
		type: "video" as const,
		elements: [videoElement],
		isMain: true,
		muted: false,
		hidden: false,
	};

	// --- Text tracks ---
	const textTracks = [];

	// Hook text overlay
	if (content.hook) {
		const hookStart = content.hookStartTime ?? 0;
		const hookEnd = hookStart + (content.hookDuration ?? 3);
		const hookElement = buildTextElement({
			content: content.hook,
			startTime: hookStart,
			endTime: Math.min(hookEnd, videoDuration),
			style: content.hookStyle,
			canvasWidth: canvasSize.width,
			canvasHeight: canvasSize.height,
		});
		textTracks.push(buildTextTrack({ name: "Hook", elements: [hookElement] }));
	}

	// Format-specific text overlays
	if (content.textOverlays) {
		for (const overlay of content.textOverlays) {
			const element = buildTextElement({
				content: overlay.content,
				startTime: overlay.startTime,
				endTime: Math.min(overlay.endTime, videoDuration),
				style: overlay.style,
				canvasWidth: canvasSize.width,
				canvasHeight: canvasSize.height,
			});
			textTracks.push(
				buildTextTrack({ name: overlay.content.slice(0, 20), elements: [element] }),
			);
		}
	}

	const now = new Date().toISOString();

	return {
		project: {
			metadata: {
				id: projectId,
				name: projectName,
				duration: videoDuration,
				createdAt: now,
				updatedAt: now,
			},
			scenes: [
				{
					id: sceneId,
					name: "Scene 1",
					isMain: true,
					tracks: [videoTrack, ...textTracks],
					bookmarks: [],
					createdAt: now,
					updatedAt: now,
				},
			],
			currentSceneId: sceneId,
			settings: {
				fps,
				canvasSize,
				background: { type: "color" as const, color: "#000000" },
			},
			version: PROJECT_VERSION,
		},
		/** The media ID that must be registered + uploaded separately */
		mediaId,
	};
}

// --- Format-aware generation ---

/**
 * Resolve a TextOverlayPlacement's start/end times based on its placement rule.
 */
function resolveOverlayTimes({
	overlay,
	videoDuration,
	hookEndTime,
}: {
	overlay: TextOverlayPlacement;
	videoDuration: number;
	hookEndTime: number;
}): { startTime: number; endTime: number } {
	if (overlay.startTime !== null && overlay.endTime !== null) {
		return {
			startTime: overlay.startTime,
			endTime: Math.min(overlay.endTime, videoDuration),
		};
	}

	let startTime: number;
	switch (overlay.placement) {
		case "start":
			startTime = 0;
			break;
		case "end":
			startTime = Math.max(0, videoDuration - overlay.duration);
			break;
		case "after-hook":
			startTime = hookEndTime;
			break;
		default:
			startTime = 0;
	}

	return {
		startTime,
		endTime: Math.min(startTime + overlay.duration, videoDuration),
	};
}

export interface GenerateFromFormatInput {
	/** Airtable Content record ID */
	contentId: string;
	/** The format definition to apply */
	formatDef: FormatDefinition;
	/** Hook text (from Airtable Content.hook) */
	hook?: string;
	/** Video duration in seconds */
	videoDuration: number;
	/** Google Drive link (stored for reference) */
	driveLink: string;
	/**
	 * Field values from Airtable that map to TextOverlayPlacement.field.
	 * e.g. { cta_text: "Shop now!", step_label: "Step 1: Open the app" }
	 */
	fieldValues?: Record<string, string>;
}

/**
 * Generate a TProject JSON using a FormatDefinition for precise overlay placement.
 *
 * This is the preferred entry point when a format config exists.
 * Falls back to `generateProject()` for ad-hoc/inline usage.
 */
export function generateProjectFromFormat({
	contentId,
	formatDef,
	hook,
	videoDuration,
	driveLink,
	fieldValues,
}: GenerateFromFormatInput) {
	const canvasSize = formatDef.canvasSize ?? DEFAULT_CANVAS;
	const fps = formatDef.fps ?? DEFAULT_FPS;
	const hp = formatDef.hookPlacement;

	// Resolve hook timing
	const hookStart = hp.startTime;
	const hookEnd = Math.min(hookStart + hp.duration, videoDuration);

	// Build hook style from format definition
	const hookStyle: TextOverlayStyle | undefined = hook
		? {
				fontSize: hp.fontSize,
				fontFamily: hp.fontFamily,
				color: hp.color,
				fontWeight: hp.fontWeight,
				textAlign: hp.textAlign,
				background: hp.background,
				positionX: hp.positionX,
				positionY: hp.positionY,
			}
		: undefined;

	// Build text overlays from format definition + field values
	const textOverlays = formatDef.textOverlays
		.map((overlay) => {
			const content = fieldValues?.[overlay.field];
			if (!content) return null;

			const { startTime, endTime } = resolveOverlayTimes({
				overlay,
				videoDuration,
				hookEndTime: hookEnd,
			});

			return {
				content,
				startTime,
				endTime,
				style: {
					fontSize: overlay.fontSize,
					fontFamily: overlay.fontFamily,
					color: overlay.color,
					fontWeight: overlay.fontWeight,
					textAlign: overlay.textAlign,
					background: overlay.background,
					positionX: overlay.positionX,
					positionY: overlay.positionY,
				} satisfies TextOverlayStyle,
			};
		})
		.filter((o): o is NonNullable<typeof o> => o !== null);

	return generateProject({
		content: {
			contentId,
			format: formatDef.format,
			hook,
			hookStyle,
			hookDuration: hp.duration,
			hookStartTime: hp.startTime,
			textOverlays,
		},
		rawContent: {
			driveLink,
			duration: videoDuration,
		},
		formatConfig: { canvasSize, fps },
	});
}
