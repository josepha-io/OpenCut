import type { TProject, TProjectMetadata } from "@/types/project";
import type { MediaAsset } from "@/types/assets";
import type { SerializedScene } from "./types";
import type { Bookmark, TimelineTrack, TScene } from "@/types/timeline";
import { getProjectDurationFromScenes } from "@/lib/scenes";

function normalizeBookmarks({ raw }: { raw: unknown }): Bookmark[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((item): Bookmark | null => {
			if (typeof item === "number") return { time: item };
			const obj = item as Record<string, unknown>;
			if (
				typeof obj !== "object" ||
				obj === null ||
				typeof obj.time !== "number"
			) {
				return null;
			}
			return {
				time: obj.time,
				...(typeof obj.note === "string" && { note: obj.note }),
				...(typeof obj.color === "string" && { color: obj.color }),
				...(typeof obj.duration === "number" && { duration: obj.duration }),
			};
		})
		.filter((b): b is Bookmark => b !== null);
}

function stripAudioBuffers({
	tracks,
}: {
	tracks: TimelineTrack[];
}): TimelineTrack[] {
	return tracks.map((track) => {
		if (track.type !== "audio") return track;
		return {
			...track,
			elements: track.elements.map((element) => {
				const { buffer: _buffer, ...rest } = element;
				return rest;
			}),
		};
	});
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
	const response = await fetch(path, {
		...init,
		headers: {
			"Content-Type": "application/json",
			...init?.headers,
		},
		credentials: "include",
	});
	return response;
}

interface ServerProjectRow {
	id: string;
	name: string;
	status: string;
	assignedUserId: string | null;
	thumbnail: string | null;
	duration: number;
	data?: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export class ServerStorageService {
	async saveProject({ project }: { project: TProject }): Promise<void> {
		const duration =
			project.metadata.duration ??
			getProjectDurationFromScenes({ scenes: project.scenes });

		const serializedScenes: SerializedScene[] = project.scenes.map(
			(scene) => ({
				id: scene.id,
				name: scene.name,
				isMain: scene.isMain,
				tracks: stripAudioBuffers({ tracks: scene.tracks }),
				bookmarks: scene.bookmarks,
				createdAt: scene.createdAt.toISOString(),
				updatedAt: scene.updatedAt.toISOString(),
			}),
		);

		const data = {
			scenes: serializedScenes,
			currentSceneId: project.currentSceneId,
			settings: project.settings,
			version: project.version,
			timelineViewState: project.timelineViewState,
		};

		const response = await apiFetch(`/api/projects/${project.metadata.id}`, {
			method: "PUT",
			body: JSON.stringify({
				name: project.metadata.name,
				data,
				thumbnail: project.metadata.thumbnail ?? null,
				duration,
			}),
		});

		if (response.status === 404) {
			// Project doesn't exist yet — create it
			await apiFetch("/api/projects", {
				method: "POST",
				body: JSON.stringify({
					id: project.metadata.id,
					name: project.metadata.name,
					data,
				}),
			});
		}
	}

	async loadProject({
		id,
	}: {
		id: string;
	}): Promise<{ project: TProject } | null> {
		const response = await apiFetch(`/api/projects/${id}`);
		if (!response.ok) return null;

		const row = (await response.json()) as ServerProjectRow;
		const data = row.data as Record<string, unknown> | undefined;
		if (!data) return null;

		const rawScenes = (data.scenes ?? []) as SerializedScene[];
		const scenes =
			rawScenes.map((scene) => ({
				id: scene.id,
				name: scene.name,
				isMain: scene.isMain,
				tracks: (scene.tracks ?? []).map((track) =>
					track.type === "video"
						? { ...track, isMain: track.isMain ?? false }
						: track,
				),
				bookmarks: normalizeBookmarks({ raw: scene.bookmarks }),
				createdAt: new Date(scene.createdAt),
				updatedAt: new Date(scene.updatedAt),
			})) ?? [];

		const project: TProject = {
			metadata: {
				id: row.id,
				name: row.name,
				thumbnail: row.thumbnail ?? undefined,
				duration:
					row.duration ?? getProjectDurationFromScenes({ scenes }),
				createdAt: new Date(row.createdAt),
				updatedAt: new Date(row.updatedAt),
			},
			scenes,
			currentSceneId: (data.currentSceneId as string) || "",
			settings: data.settings as TProject["settings"],
			version: (data.version as number) ?? 1,
			timelineViewState: data.timelineViewState as TProject["timelineViewState"],
		};

		return { project };
	}

	async loadAllProjects(): Promise<TProject[]> {
		const response = await apiFetch("/api/projects");
		if (!response.ok) return [];

		const rows = (await response.json()) as ServerProjectRow[];
		const projects: TProject[] = [];

		for (const row of rows) {
			const result = await this.loadProject({ id: row.id });
			if (result?.project) {
				projects.push(result.project);
			}
		}

		return projects.sort(
			(a, b) =>
				b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime(),
		);
	}

	async loadAllProjectsMetadata(): Promise<TProjectMetadata[]> {
		const response = await apiFetch("/api/projects");
		if (!response.ok) return [];

		const rows = (await response.json()) as ServerProjectRow[];

		return rows
			.map((row) => ({
				id: row.id,
				name: row.name,
				thumbnail: row.thumbnail ?? undefined,
				duration: row.duration,
				createdAt: new Date(row.createdAt),
				updatedAt: new Date(row.updatedAt),
			}))
			.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
	}

	async deleteProject({ id }: { id: string }): Promise<void> {
		await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
	}

	async saveMediaAsset({
		projectId,
		mediaAsset,
	}: {
		projectId: string;
		mediaAsset: MediaAsset;
	}): Promise<void> {
		// 1. Register metadata on server
		await apiFetch(`/api/projects/${projectId}/media`, {
			method: "POST",
			body: JSON.stringify({
				id: mediaAsset.id,
				name: mediaAsset.name,
				type: mediaAsset.type,
				size: mediaAsset.file.size,
				width: mediaAsset.width,
				height: mediaAsset.height,
				duration: mediaAsset.duration,
				fps: mediaAsset.fps,
			}),
		});

		// 2. Get signed upload URL
		const urlResponse = await apiFetch(
			`/api/projects/${projectId}/media/${mediaAsset.id}/upload-url`,
			{
				method: "POST",
				body: JSON.stringify({
					contentType: mediaAsset.file.type || "application/octet-stream",
				}),
			},
		);

		if (!urlResponse.ok) {
			throw new Error("Failed to get upload URL");
		}

		const { url } = (await urlResponse.json()) as { url: string };

		// 3. Upload directly to GCS
		const uploadResponse = await fetch(url, {
			method: "PUT",
			headers: {
				"Content-Type": mediaAsset.file.type || "application/octet-stream",
			},
			body: mediaAsset.file,
		});

		if (!uploadResponse.ok) {
			throw new Error(`GCS upload failed: ${uploadResponse.status}`);
		}
	}

	async loadMediaAsset({
		projectId,
		id,
	}: {
		projectId: string;
		id: string;
	}): Promise<MediaAsset | null> {
		// 1. Get signed download URL
		const urlResponse = await apiFetch(
			`/api/projects/${projectId}/media/${id}/download-url`,
		);

		if (!urlResponse.ok) return null;

		const { url } = (await urlResponse.json()) as { url: string };

		// 2. Download file from GCS
		const fileResponse = await fetch(url);
		if (!fileResponse.ok) return null;

		const blob = await fileResponse.blob();

		// 3. Get metadata
		const metaResponse = await apiFetch(`/api/projects/${projectId}/media`);
		if (!metaResponse.ok) return null;

		const allMedia = (await metaResponse.json()) as Array<{
			id: string;
			name: string;
			type: string;
			size: number;
			width: number | null;
			height: number | null;
			media_duration: number | null;
			fps: number | null;
		}>;

		const metadata = allMedia.find((m) => m.id === id);
		if (!metadata) return null;

		const file = new File([blob], metadata.name, { type: blob.type });
		const objectUrl = URL.createObjectURL(file);

		return {
			id: metadata.id,
			name: metadata.name,
			type: metadata.type as MediaAsset["type"],
			file,
			url: objectUrl,
			width: metadata.width ?? undefined,
			height: metadata.height ?? undefined,
			duration: metadata.media_duration ?? undefined,
		};
	}

	async loadAllMediaAssets({
		projectId,
	}: {
		projectId: string;
	}): Promise<MediaAsset[]> {
		const metaResponse = await apiFetch(`/api/projects/${projectId}/media`);
		if (!metaResponse.ok) return [];

		const allMedia = (await metaResponse.json()) as Array<{ id: string }>;
		const mediaItems: MediaAsset[] = [];

		// Download in parallel (max 4 concurrent)
		const concurrency = 4;
		for (let i = 0; i < allMedia.length; i += concurrency) {
			const batch = allMedia.slice(i, i + concurrency);
			const results = await Promise.all(
				batch.map((m) => this.loadMediaAsset({ projectId, id: m.id })),
			);
			for (const result of results) {
				if (result) mediaItems.push(result);
			}
		}

		return mediaItems;
	}

	async deleteMediaAsset({
		projectId,
		id,
	}: {
		projectId: string;
		id: string;
	}): Promise<void> {
		await apiFetch(`/api/projects/${projectId}/media/${id}`, {
			method: "DELETE",
		});
	}

	async deleteProjectMedia({
		projectId,
	}: {
		projectId: string;
	}): Promise<void> {
		const metaResponse = await apiFetch(`/api/projects/${projectId}/media`);
		if (!metaResponse.ok) return;

		const allMedia = (await metaResponse.json()) as Array<{ id: string }>;
		await Promise.all(
			allMedia.map((m) => this.deleteMediaAsset({ projectId, id: m.id })),
		);
	}

	async clearAllData(): Promise<void> {
		// No-op for server storage — projects are managed server-side
	}

	async getStorageInfo(): Promise<{
		projects: number;
		isOPFSSupported: boolean;
		isIndexedDBSupported: boolean;
	}> {
		const response = await apiFetch("/api/projects");
		const rows = response.ok
			? ((await response.json()) as unknown[])
			: [];

		return {
			projects: rows.length,
			isOPFSSupported: true,
			isIndexedDBSupported: true,
		};
	}

	async getProjectStorageInfo({
		projectId,
	}: {
		projectId: string;
	}): Promise<{ mediaItems: number }> {
		const response = await apiFetch(`/api/projects/${projectId}/media`);
		const rows = response.ok
			? ((await response.json()) as unknown[])
			: [];

		return { mediaItems: rows.length };
	}

	// Sound effects — delegated to IndexedDB (user-local preference, not project data)
	private _soundsDelegate: import("./service").StorageService | null = null;

	private getSoundsDelegate() {
		if (!this._soundsDelegate) {
			// Lazy import to avoid circular dependency
			const { StorageService } =
				require("./service") as typeof import("./service");
			this._soundsDelegate = new StorageService();
		}
		return this._soundsDelegate;
	}

	async loadSavedSounds() {
		return this.getSoundsDelegate().loadSavedSounds();
	}

	async saveSoundEffect(params: {
		soundEffect: import("@/types/sounds").SoundEffect;
	}) {
		return this.getSoundsDelegate().saveSoundEffect(params);
	}

	async removeSavedSound(params: { soundId: number }) {
		return this.getSoundsDelegate().removeSavedSound(params);
	}

	async isSoundSaved(params: { soundId: number }) {
		return this.getSoundsDelegate().isSoundSaved(params);
	}

	async clearSavedSounds() {
		return this.getSoundsDelegate().clearSavedSounds();
	}

	isOPFSSupported(): boolean {
		return true;
	}

	isIndexedDBSupported(): boolean {
		return true;
	}

	isFullySupported(): boolean {
		return true;
	}
}
