/**
 * Input types for the TProject JSON generator.
 * These represent the data coming from Airtable Content records.
 */

export interface ContentRecord {
	/** Airtable Content record ID */
	contentId: string;
	/** Hook text to overlay on the video */
	hook?: string;
	/** Styling config for the hook text */
	hookStyle?: TextOverlayStyle;
	/** Hook display duration in seconds (default: 3) */
	hookDuration?: number;
	/** Hook start time in seconds (default: 0) */
	hookStartTime?: number;
	/** Format name (e.g. "reels", "tiktok", "shorts") */
	format: string;
	/** Additional text overlays defined by the format */
	textOverlays?: TextOverlayConfig[];
	/** Briefing text (informational, not placed on timeline) */
	briefing?: string;
}

export interface RawContentRecord {
	/** Google Drive link to the raw video */
	driveLink: string;
	/** Video duration in seconds */
	duration: number;
	/** Video width in pixels */
	width?: number;
	/** Video height in pixels */
	height?: number;
	/** Frames per second */
	fps?: number;
}

export interface TextOverlayStyle {
	fontSize?: number;
	fontFamily?: string;
	color?: string;
	fontWeight?: "normal" | "bold";
	fontStyle?: "normal" | "italic";
	textAlign?: "left" | "center" | "right";
	background?: {
		enabled?: boolean;
		color?: string;
		cornerRadius?: number;
		paddingX?: number;
		paddingY?: number;
	};
	/** Position as fraction of canvas (0-1). Default: centered */
	positionX?: number;
	positionY?: number;
	/** Scale factor. Default: 1 */
	scale?: number;
}

export interface TextOverlayConfig {
	/** Text content */
	content: string;
	/** Start time in seconds */
	startTime: number;
	/** End time in seconds */
	endTime: number;
	/** Styling for this overlay */
	style?: TextOverlayStyle;
}

export interface FormatConfig {
	/** Canvas size (default: 1080x1920 for vertical video) */
	canvasSize?: { width: number; height: number };
	/** FPS (default: 30) */
	fps?: number;
}

export interface GenerateProjectInput {
	content: ContentRecord;
	rawContent: RawContentRecord;
	formatConfig?: FormatConfig;
}
