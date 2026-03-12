"use client";

import { useState } from "react";
import { TransitionTopIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/utils/ui";
import { getExportMimeType, uploadExportedVideo } from "@/lib/export";
import { Check, Copy, ExternalLink, RotateCcw, Upload } from "lucide-react";
import { useEditor } from "@/hooks/use-editor";

type UploadPhase = "idle" | "exporting" | "uploading" | "done" | "error";

const USE_SERVER_STORAGE =
	typeof window !== "undefined" &&
	typeof process !== "undefined" &&
	process.env.NEXT_PUBLIC_USE_SERVER_STORAGE === "true";

export function ExportButton() {
	const [isExportPopoverOpen, setIsExportPopoverOpen] = useState(false);
	const editor = useEditor();

	const hasProject = !!editor.project.getActiveOrNull();

	const handlePopoverOpenChange = ({ open }: { open: boolean }) => {
		if (!open) {
			editor.project.cancelExport();
			editor.project.clearExportState();
		}
		setIsExportPopoverOpen(open);
	};

	return (
		<Popover open={isExportPopoverOpen} onOpenChange={(open) => handlePopoverOpenChange({ open })}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex items-center gap-1.5 rounded-md bg-[#38BDF8] px-[0.12rem] py-[0.12rem] text-white",
						hasProject ? "cursor-pointer" : "cursor-not-allowed opacity-50",
					)}
					onClick={hasProject ? () => setIsExportPopoverOpen(true) : undefined}
					disabled={!hasProject}
					onKeyDown={(event) => {
						if (hasProject && (event.key === "Enter" || event.key === " ")) {
							event.preventDefault();
							setIsExportPopoverOpen(true);
						}
					}}
				>
					<div className="relative flex items-center gap-1.5 rounded-[0.6rem] bg-linear-270 from-[#2567EC] to-[#37B6F7] px-4 py-1 shadow-[0_1px_3px_0px_rgba(0,0,0,0.65)]">
						<HugeiconsIcon icon={TransitionTopIcon} className="z-50 size-4" />
						<span className="z-50 text-[0.875rem]">Export</span>
						<div className="absolute top-0 left-0 z-10 flex size-full items-center justify-center rounded-[0.6rem] bg-linear-to-t from-white/0 to-white/50">
							<div className="absolute top-[0.08rem] z-50 h-[calc(100%-2px)] w-[calc(100%-2px)] rounded-[0.6rem] bg-linear-270 from-[#2567EC] to-[#37B6F7]"></div>
						</div>
					</div>
				</button>
			</PopoverTrigger>
			{hasProject && (
				<ExportPopover onOpenChange={setIsExportPopoverOpen} />
			)}
		</Popover>
	);
}

function ExportPopover({
	onOpenChange,
}: {
	onOpenChange: (open: boolean) => void;
}) {
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const { isExporting, progress } = editor.project.getExportState();
	const [phase, setPhase] = useState<UploadPhase>("idle");
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [driveLink, setDriveLink] = useState<string | null>(null);

	const handleExportAndUpload = async () => {
		if (!activeProject) return;

		setPhase("exporting");
		setUploadError(null);

		// 1. Render video — hardcoded MP4 High with audio
		const result = await editor.project.export({
			options: {
				format: "mp4",
				quality: "high",
				fps: activeProject.settings.fps,
				includeAudio: true,
			},
		});

		if (result.cancelled) {
			editor.project.clearExportState();
			setPhase("idle");
			return;
		}

		if (!result.success || !result.buffer) {
			setPhase("error");
			setUploadError(result.error || "Export failed");
			return;
		}

		// 2. Upload to Google Drive (if server storage enabled)
		if (USE_SERVER_STORAGE) {
			setPhase("uploading");

			const filename = `${activeProject.metadata.name}.mp4`;
			try {
				const uploadResult = await uploadExportedVideo({
					buffer: result.buffer,
					projectId: activeProject.metadata.id,
					filename,
					mimeType: getExportMimeType({ format: "mp4" }),
				});

				setDriveLink(uploadResult.driveViewLink);
				setPhase("done");
				editor.project.clearExportState();
			} catch (err) {
				setPhase("error");
				setUploadError(
					err instanceof Error ? err.message : "Upload failed",
				);
			}
		} else {
			// Fallback: browser download (original behavior)
			const { downloadBuffer, getExportFileExtension } = await import("@/lib/export");
			downloadBuffer({
				buffer: result.buffer,
				filename: `${activeProject.metadata.name}${getExportFileExtension({ format: "mp4" })}`,
				mimeType: getExportMimeType({ format: "mp4" }),
			});
			editor.project.clearExportState();
			onOpenChange(false);
		}
	};

	const handleCancel = () => {
		editor.project.cancelExport();
		setPhase("idle");
	};

	const handleRetry = () => {
		setUploadError(null);
		setDriveLink(null);
		handleExportAndUpload();
	};

	return (
		<PopoverContent className="bg-background mr-4 flex w-80 flex-col p-0">
			{/* Header */}
			<div className="flex items-center justify-between p-3 border-b">
				<h3 className="font-medium text-sm">
					{phase === "idle" && "Export project"}
					{phase === "exporting" && "Rendering video..."}
					{phase === "uploading" && "Uploading to Drive..."}
					{phase === "done" && "Export complete"}
					{phase === "error" && "Export failed"}
				</h3>
			</div>

			<div className="flex flex-col gap-4">
				{/* Idle — single export button */}
				{phase === "idle" && (
					<div className="p-3">
						<p className="text-muted-foreground text-xs mb-3">
							Export as MP4 (High quality) with audio{USE_SERVER_STORAGE ? " and upload to Google Drive" : ""}.
						</p>
						<Button onClick={handleExportAndUpload} className="w-full gap-2">
							<Upload className="size-4" />
							{USE_SERVER_STORAGE ? "Export & Upload" : "Export"}
						</Button>
					</div>
				)}

				{/* Exporting — progress bar */}
				{(phase === "exporting" && isExporting) && (
					<div className="space-y-4 p-3">
						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between text-center">
								<p className="text-muted-foreground text-sm">
									Rendering: {Math.round(progress * 100)}%
								</p>
							</div>
							<Progress value={progress * 100} className="w-full" />
						</div>
						<Button
							variant="outline"
							className="w-full rounded-md"
							onClick={handleCancel}
						>
							Cancel
						</Button>
					</div>
				)}

				{/* Uploading — indeterminate progress */}
				{phase === "uploading" && (
					<div className="space-y-4 p-3">
						<div className="flex flex-col gap-2">
							<p className="text-muted-foreground text-sm">
								Uploading to Google Drive...
							</p>
							<Progress className="w-full animate-pulse" value={100} />
						</div>
					</div>
				)}

				{/* Done — show Drive link */}
				{phase === "done" && (
					<div className="space-y-3 p-3">
						<div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
							<Check className="size-4" />
							<span>Uploaded to Google Drive</span>
						</div>
						{driveLink && (
							<a
								href={driveLink}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2 text-sm text-blue-500 hover:underline"
							>
								<ExternalLink className="size-4" />
								Open in Drive
							</a>
						)}
						<Button
							variant="outline"
							className="w-full"
							onClick={() => onOpenChange(false)}
						>
							Close
						</Button>
					</div>
				)}

				{/* Error */}
				{phase === "error" && (
					<ExportError
						error={uploadError || "Unknown error"}
						onRetry={handleRetry}
					/>
				)}
			</div>
		</PopoverContent>
	);
}

function ExportError({
	error,
	onRetry,
}: {
	error: string;
	onRetry: () => void;
}) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(error);
		setCopied(true);
		setTimeout(() => setCopied(false), 1000);
	};

	return (
		<div className="space-y-4 p-3">
			<div className="flex flex-col gap-1.5">
				<p className="text-destructive text-sm font-medium">Export failed</p>
				<p className="text-muted-foreground text-xs">{error}</p>
			</div>

			<div className="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					className="h-8 flex-1 text-xs"
					onClick={handleCopy}
				>
					{copied ? <Check className="text-constructive" /> : <Copy />}
					Copy
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="h-8 flex-1 text-xs"
					onClick={onRetry}
				>
					<RotateCcw />
					Retry
				</Button>
			</div>
		</div>
	);
}
