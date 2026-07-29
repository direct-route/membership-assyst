import { PUBLIC_POCKETBASE_URL } from '$env/static/public';

export function pbFileUrl(collection, recordId, filename) {
	const base = PUBLIC_POCKETBASE_URL.replace(/^http:\/\/(?!localhost)/, 'https://');
	return `${base}/api/files/${collection}/${recordId}/${filename}`;
}
