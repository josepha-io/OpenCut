/**
 * Validation script for the project generator.
 * Verifies that generateProject() produces valid TProject-compatible JSON.
 *
 * Usage:
 *   cd apps/web
 *   npx tsx scripts/test-project-generator.ts
 */

import { generateProject, generateProjectFromFormat, getFormatDefinition } from "../src/lib/project-generator";
import type { GenerateProjectInput } from "../src/lib/project-generator";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
	if (condition) {
		passed++;
		console.log(`  ✓ ${message}`);
	} else {
		failed++;
		console.error(`  ✗ ${message}`);
	}
}

// --- Test 1: Full project with hook and text overlays ---
console.log("\nTest 1: Full project with hook and text overlays");
{
	const input: GenerateProjectInput = {
		content: {
			contentId: "rec123",
			format: "reels",
			hook: "This changed everything",
			hookStyle: {
				fontSize: 64,
				color: "#ffff00",
				fontWeight: "bold",
				background: { enabled: true, color: "#000000", cornerRadius: 8, paddingX: 16, paddingY: 8 },
				positionX: 0.5,
				positionY: 0.2,
			},
			hookDuration: 3,
			hookStartTime: 0,
			textOverlays: [
				{
					content: "Shop now at example.com",
					startTime: 10,
					endTime: 15,
					style: { fontSize: 32, color: "#ffffff", positionY: 0.85 },
				},
			],
		},
		rawContent: {
			driveLink: "https://drive.google.com/file/d/abc/view",
			duration: 60,
			width: 1080,
			height: 1920,
		},
	};

	const { project, mediaId } = generateProject(input);

	assert(typeof project.metadata.id === "string" && project.metadata.id.length > 0, "project has ID");
	assert(project.metadata.name.startsWith("reels_"), "project name starts with format");
	assert(project.metadata.name.includes("rec123"), "project name includes contentId");
	assert(project.metadata.duration === 60, "project duration matches video");
	assert(project.version === 9, "project version is 9");
	assert(project.settings.fps === 30, "fps is 30");
	assert(project.settings.canvasSize.width === 1080, "canvas width 1080");
	assert(project.settings.canvasSize.height === 1920, "canvas height 1920");
	assert(project.settings.background.type === "color", "background is color");
	assert(project.scenes.length === 1, "has 1 scene");

	const scene = project.scenes[0];
	assert(scene.isMain === true, "scene is main");
	assert(scene.tracks.length === 3, "3 tracks: video + hook + overlay");

	// Video track
	const videoTrack = scene.tracks[0];
	assert(videoTrack.type === "video", "first track is video");
	assert((videoTrack as any).isMain === true, "video track is main");
	assert((videoTrack as any).elements.length === 1, "video track has 1 element");

	const videoEl = (videoTrack as any).elements[0];
	assert(videoEl.type === "video", "video element type is video");
	assert(videoEl.mediaId === mediaId, "video element mediaId matches returned mediaId");
	assert(videoEl.duration === 60, "video element duration is 60");
	assert(videoEl.startTime === 0, "video element starts at 0");
	assert(videoEl.trimStart === 0, "video trimStart is 0");
	assert(videoEl.trimEnd === 60, "video trimEnd is 60");
	assert(videoEl.transform.scale === 1, "video transform scale is 1");
	assert(videoEl.opacity === 1, "video opacity is 1");

	// Hook track
	const hookTrack = scene.tracks[1];
	assert(hookTrack.type === "text", "second track is text (hook)");
	assert((hookTrack as any).name === "Hook", "hook track named Hook");

	const hookEl = (hookTrack as any).elements[0];
	assert(hookEl.type === "text", "hook element type is text");
	assert(hookEl.content === "This changed everything", "hook content matches");
	assert(hookEl.fontSize === 64, "hook fontSize from style");
	assert(hookEl.color === "#ffff00", "hook color from style");
	assert(hookEl.fontWeight === "bold", "hook fontWeight from style");
	assert(hookEl.background.enabled === true, "hook background enabled");
	assert(hookEl.background.color === "#000000", "hook background color");
	assert(hookEl.background.cornerRadius === 8, "hook background cornerRadius");
	assert(hookEl.startTime === 0, "hook starts at 0");
	assert(hookEl.duration === 3, "hook duration is 3");
	assert(hookEl.textDecoration === "none", "hook textDecoration is none");
	assert(hookEl.transform.position.y < 0, "hook positioned above center (y < 0)");

	// Format overlay track
	const overlayTrack = scene.tracks[2];
	assert(overlayTrack.type === "text", "third track is text (overlay)");

	const overlayEl = (overlayTrack as any).elements[0];
	assert(overlayEl.content === "Shop now at example.com", "overlay content matches");
	assert(overlayEl.startTime === 10, "overlay starts at 10");
	assert(overlayEl.duration === 5, "overlay duration is 5 (15-10)");
	assert(overlayEl.transform.position.y > 0, "overlay positioned below center (y > 0)");

	// Dates are ISO strings
	assert(typeof project.metadata.createdAt === "string", "createdAt is string");
	assert(typeof scene.createdAt === "string", "scene createdAt is string");
}

// --- Test 2: Minimal project — no hook, no overlays ---
console.log("\nTest 2: Minimal project — no hook, no overlays");
{
	const input: GenerateProjectInput = {
		content: {
			contentId: "rec456",
			format: "tiktok",
		},
		rawContent: {
			driveLink: "https://drive.google.com/file/d/xyz/view",
			duration: 15,
		},
	};

	const { project } = generateProject(input);

	assert(project.metadata.name.startsWith("tiktok_"), "name starts with tiktok");
	assert(project.metadata.duration === 15, "duration is 15");
	assert(project.scenes[0].tracks.length === 1, "only 1 track (video, no text)");
	assert(project.scenes[0].tracks[0].type === "video", "single track is video");
}

// --- Test 3: Custom format config ---
console.log("\nTest 3: Custom format config (landscape)");
{
	const input: GenerateProjectInput = {
		content: {
			contentId: "rec789",
			format: "youtube",
			hook: "Watch this",
		},
		rawContent: {
			driveLink: "https://drive.google.com/file/d/def/view",
			duration: 300,
		},
		formatConfig: {
			canvasSize: { width: 1920, height: 1080 },
			fps: 60,
		},
	};

	const { project } = generateProject(input);

	assert(project.settings.canvasSize.width === 1920, "canvas width 1920");
	assert(project.settings.canvasSize.height === 1080, "canvas height 1080");
	assert(project.settings.fps === 60, "fps is 60");
	assert(project.scenes[0].tracks.length === 2, "2 tracks: video + hook");
}

// --- Test 4: Overlay end time clamped to video duration ---
console.log("\nTest 4: Overlay clamped to video duration");
{
	const input: GenerateProjectInput = {
		content: {
			contentId: "rec000",
			format: "shorts",
			textOverlays: [
				{ content: "CTA", startTime: 8, endTime: 999 },
			],
		},
		rawContent: {
			driveLink: "https://drive.google.com/file/d/ghi/view",
			duration: 10,
		},
	};

	const { project } = generateProject(input);

	const overlayEl = (project.scenes[0].tracks[1] as any).elements[0];
	assert(overlayEl.duration === 2, "overlay clamped: 10 - 8 = 2s");
}

// --- Test 5: Hook clamped to video duration ---
console.log("\nTest 5: Hook clamped to video duration");
{
	const input: GenerateProjectInput = {
		content: {
			contentId: "recShort",
			format: "reels",
			hook: "Quick hook",
			hookDuration: 10,
			hookStartTime: 0,
		},
		rawContent: {
			driveLink: "https://drive.google.com/file/d/jkl/view",
			duration: 5,
		},
	};

	const { project } = generateProject(input);

	const hookEl = (project.scenes[0].tracks[1] as any).elements[0];
	assert(hookEl.duration === 5, "hook clamped to video duration (5s)");
}

// --- Test 6: generateProjectFromFormat with "demo" format ---
console.log("\nTest 6: generateProjectFromFormat with demo format");
{
	const formatDef = getFormatDefinition({ format: "demo" });
	assert(formatDef !== null, "demo format exists in registry");

	const { project, mediaId } = generateProjectFromFormat({
		contentId: "recDemo1",
		formatDef: formatDef!,
		hook: "This product is amazing",
		videoDuration: 30,
		driveLink: "https://drive.google.com/file/d/abc/view",
		fieldValues: { cta_text: "Shop now at example.com" },
	});

	assert(project.version === 9, "version is 9");
	assert(project.settings.canvasSize.width === 1080, "demo canvas 1080");
	assert(project.settings.canvasSize.height === 1920, "demo canvas 1920");
	assert(project.scenes[0].tracks.length === 3, "3 tracks: video + hook + cta");

	const hookEl = (project.scenes[0].tracks[1] as any).elements[0];
	assert(hookEl.content === "This product is amazing", "hook content matches");
	assert(hookEl.fontSize === 64, "hook fontSize from demo format (64)");
	assert(hookEl.startTime === 0, "hook starts at 0");
	assert(hookEl.duration === 3, "hook duration 3s from demo format");
	assert(hookEl.background.enabled === true, "hook background enabled from format");
	assert(hookEl.background.cornerRadius === 12, "hook cornerRadius from format");

	const ctaEl = (project.scenes[0].tracks[2] as any).elements[0];
	assert(ctaEl.content === "Shop now at example.com", "cta content from fieldValues");
	assert(ctaEl.fontSize === 44, "cta fontSize from demo format (44)");
	// "end" placement: startTime = 30 - 4 = 26
	assert(ctaEl.startTime === 26, "cta placed at end (30 - 4 = 26)");
	assert(ctaEl.duration === 4, "cta duration 4s from demo format");
}

// --- Test 7: generateProjectFromFormat with "tutorial" format ---
console.log("\nTest 7: generateProjectFromFormat with tutorial format");
{
	const formatDef = getFormatDefinition({ format: "tutorial" });
	assert(formatDef !== null, "tutorial format exists in registry");

	const { project } = generateProjectFromFormat({
		contentId: "recTut1",
		formatDef: formatDef!,
		hook: "Learn this in 60 seconds",
		videoDuration: 60,
		driveLink: "https://drive.google.com/file/d/xyz/view",
		fieldValues: {
			step_label: "Step 1: Open the app",
			cta_text: "Follow for more!",
		},
	});

	assert(project.scenes[0].tracks.length === 4, "4 tracks: video + hook + step + cta");

	const stepEl = (project.scenes[0].tracks[2] as any).elements[0];
	assert(stepEl.content === "Step 1: Open the app", "step_label content");
	// "after-hook" placement: starts at hookEnd = 0 + 3 = 3
	assert(stepEl.startTime === 3, "step placed after hook (at 3s)");
	assert(stepEl.duration === 5, "step duration 5s from tutorial format");

	const ctaEl = (project.scenes[0].tracks[3] as any).elements[0];
	assert(ctaEl.content === "Follow for more!", "cta content");
	// "end" placement: 60 - 5 = 55
	assert(ctaEl.startTime === 55, "cta placed at end (60 - 5 = 55)");
}

// --- Test 8: Format-aware generation skips missing field values ---
console.log("\nTest 8: Format skips overlays with missing field values");
{
	const formatDef = getFormatDefinition({ format: "tutorial" });

	const { project } = generateProjectFromFormat({
		contentId: "recSkip",
		formatDef: formatDef!,
		hook: "Hook only",
		videoDuration: 20,
		driveLink: "https://drive.google.com/file/d/skip/view",
		fieldValues: {}, // no cta_text or step_label
	});

	// Only video + hook tracks (no text overlays since fieldValues empty)
	assert(project.scenes[0].tracks.length === 2, "2 tracks: video + hook (overlays skipped)");
}

// --- Test 9: Unknown format returns null from registry ---
console.log("\nTest 9: Unknown format returns null");
{
	const formatDef = getFormatDefinition({ format: "nonexistent" });
	assert(formatDef === null, "unknown format returns null");
}

// --- Summary ---
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
	process.exit(1);
}
