import type { FormatDefinition } from "./schema";

/**
 * "Demo" format — short product demonstration videos.
 *
 * Layout:
 * - Hook text: top-third, white on semi-transparent black, 3s
 * - CTA text: bottom area, appears in the last 4 seconds
 */
export const demoFormat: FormatDefinition = {
	format: "demo",
	label: "Product Demo",
	canvasSize: { width: 1080, height: 1920 },
	fps: 30,
	hookPlacement: {
		startTime: 0,
		duration: 3,
		positionX: 0.5,
		positionY: 0.22,
		fontSize: 64,
		fontFamily: "Inter",
		color: "#FFFFFF",
		fontWeight: "bold",
		textAlign: "center",
		background: {
			enabled: true,
			color: "#000000CC",
			cornerRadius: 12,
			paddingX: 24,
			paddingY: 12,
		},
	},
	textOverlays: [
		{
			field: "cta_text",
			startTime: null,
			endTime: null,
			duration: 4,
			placement: "end",
			positionX: 0.5,
			positionY: 0.78,
			fontSize: 44,
			fontFamily: "Inter",
			color: "#FFFFFF",
			fontWeight: "bold",
			textAlign: "center",
			background: {
				enabled: true,
				color: "#000000AA",
				cornerRadius: 8,
				paddingX: 20,
				paddingY: 10,
			},
		},
	],
};
