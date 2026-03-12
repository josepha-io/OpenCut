/**
 * Format configuration schema.
 *
 * Each format defines how hook text and additional text overlays
 * are placed on the video timeline. Positions use fractional coordinates
 * (0-1) relative to the canvas — the project generator converts them
 * to pixel offsets.
 */

export interface HookPlacement {
	/** Start time in seconds (default: 0) */
	startTime: number;
	/** Duration in seconds (default: 3) */
	duration: number;
	/** Horizontal position as fraction of canvas width (0=left, 0.5=center, 1=right) */
	positionX: number;
	/** Vertical position as fraction of canvas height (0=top, 0.5=center, 1=bottom) */
	positionY: number;
	fontSize: number;
	fontFamily: string;
	color: string;
	fontWeight: "normal" | "bold";
	textAlign: "left" | "center" | "right";
	background: {
		enabled: boolean;
		color: string;
		cornerRadius: number;
		paddingX: number;
		paddingY: number;
	};
}

export interface TextOverlayPlacement {
	/**
	 * Airtable field name that provides the text content.
	 * If the field value is empty/missing, the overlay is skipped.
	 */
	field: string;
	/**
	 * Fixed start time in seconds. If null, uses `placement` rule instead.
	 */
	startTime: number | null;
	/**
	 * Fixed end time in seconds. If null, computed from startTime + duration
	 * or from `placement` rule.
	 */
	endTime: number | null;
	/** Duration in seconds (used when startTime/endTime are derived) */
	duration: number;
	/**
	 * Placement rule when startTime is null:
	 * - "start": overlay appears at 0s
	 * - "end": overlay appears at (videoDuration - duration)
	 * - "after-hook": overlay appears right after the hook ends
	 */
	placement: "start" | "end" | "after-hook";
	positionX: number;
	positionY: number;
	fontSize: number;
	fontFamily: string;
	color: string;
	fontWeight: "normal" | "bold";
	textAlign: "left" | "center" | "right";
	background?: {
		enabled: boolean;
		color: string;
		cornerRadius: number;
		paddingX: number;
		paddingY: number;
	};
}

export interface FormatDefinition {
	/** Format identifier (matches Airtable format_name) */
	format: string;
	/** Display name */
	label: string;
	/** Canvas size — defaults to 1080x1920 (9:16 vertical) */
	canvasSize?: { width: number; height: number };
	/** FPS — defaults to 30 */
	fps?: number;
	/** How the hook text is placed */
	hookPlacement: HookPlacement;
	/** Additional text overlays beyond the hook */
	textOverlays: TextOverlayPlacement[];
}
