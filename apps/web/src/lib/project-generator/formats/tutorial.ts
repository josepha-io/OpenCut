import type { FormatDefinition } from "./schema";

/**
 * "Tutorial" format — step-by-step instructional videos.
 *
 * Layout:
 * - Hook text: center-top, white bold, 3s
 * - Step label: appears right after hook, upper area, 5s
 * - CTA text: bottom area, last 5 seconds
 */
export const tutorialFormat: FormatDefinition = {
	format: "tutorial",
	label: "Tutorial",
	canvasSize: { width: 1080, height: 1920 },
	fps: 30,
	hookPlacement: {
		startTime: 0,
		duration: 3,
		positionX: 0.5,
		positionY: 0.18,
		fontSize: 56,
		fontFamily: "Inter",
		color: "#FFFFFF",
		fontWeight: "bold",
		textAlign: "center",
		background: {
			enabled: true,
			color: "#1a1a1aDD",
			cornerRadius: 16,
			paddingX: 28,
			paddingY: 14,
		},
	},
	textOverlays: [
		{
			field: "step_label",
			startTime: null,
			endTime: null,
			duration: 5,
			placement: "after-hook",
			positionX: 0.5,
			positionY: 0.15,
			fontSize: 40,
			fontFamily: "Inter",
			color: "#FFFFFF",
			fontWeight: "bold",
			textAlign: "center",
			background: {
				enabled: true,
				color: "#333333CC",
				cornerRadius: 8,
				paddingX: 16,
				paddingY: 8,
			},
		},
		{
			field: "cta_text",
			startTime: null,
			endTime: null,
			duration: 5,
			placement: "end",
			positionX: 0.5,
			positionY: 0.82,
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
