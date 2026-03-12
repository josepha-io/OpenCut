import { EXPORT_MIME_TYPES } from "@/constants/export-constants";
import type { ExportFormat } from "@/types/export";

export function getExportMimeType({
	format,
}: {
	format: ExportFormat;
}): string {
	return EXPORT_MIME_TYPES[format];
}

export function getExportFileExtension({
	format,
}: {
	format: ExportFormat;
}): string {
	return `.${format}`;
}

export function downloadBuffer({
	buffer,
	filename,
	mimeType,
}: {
	buffer: ArrayBuffer;
	filename: string;
	mimeType: string;
}): void {
	const blob = new Blob([buffer], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const downloadLink = document.createElement("a");
	downloadLink.href = url;
	downloadLink.download = filename;
	document.body.appendChild(downloadLink);
	downloadLink.click();
	document.body.removeChild(downloadLink);
	URL.revokeObjectURL(url);
}

export async function uploadExportedVideo({
	buffer,
	projectId,
	filename,
	mimeType,
}: {
	buffer: ArrayBuffer;
	projectId: string;
	filename: string;
	mimeType: string;
}): Promise<{
	driveFileId: string;
	driveViewLink: string;
	projectStatus: string;
}> {
	const blob = new Blob([buffer], { type: mimeType });
	const file = new File([blob], filename, { type: mimeType });

	const formData = new FormData();
	formData.append("file", file);
	formData.append("projectId", projectId);
	formData.append("filename", filename);

	const response = await fetch("/api/export/upload", {
		method: "POST",
		body: formData,
		credentials: "include",
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			(errorData as { message?: string }).message ??
				`Upload failed (${response.status})`,
		);
	}

	return response.json();
}
