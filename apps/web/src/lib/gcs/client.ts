import { Storage } from "@google-cloud/storage";
import { webEnv } from "@opencut/env/web";

let _storage: Storage | null = null;

export function getGCSStorage(): Storage {
	if (!_storage) {
		_storage = new Storage({
			keyFilename: webEnv.GOOGLE_APPLICATION_CREDENTIALS,
		});
	}
	return _storage;
}

export function getGCSBucket() {
	const bucketName = webEnv.GCS_BUCKET_NAME;
	if (!bucketName) {
		throw new Error("GCS_BUCKET_NAME is not configured");
	}
	return getGCSStorage().bucket(bucketName);
}

export function getMediaPath({
	projectId,
	mediaId,
}: {
	projectId: string;
	mediaId: string;
}) {
	return `projects/${projectId}/media/${mediaId}`;
}
