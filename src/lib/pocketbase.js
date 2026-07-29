import PocketBase from 'pocketbase'
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD } from '$env/static/private';

// Ensure file URLs always use HTTPS (env var may be http for local PB but prod needs https)
export const PB_URL = PUBLIC_POCKETBASE_URL;
export function pbFileUrl(collection, recordId, filename) {
	const base = PUBLIC_POCKETBASE_URL.replace(/^http:\/\/(?!localhost)/, 'https://');
	return `${base}/api/files/${collection}/${recordId}/${filename}`;
}

export const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
pb.autoCancellation(false);

export async function getAdminPb() {
	const adminPb = new PocketBase(PUBLIC_POCKETBASE_URL);
	adminPb.autoCancellation(false);
	await adminPb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
	return adminPb;
}

// Helper function to retry PocketBase operations
export async function withRetry(operation, maxRetries = 3, delay = 1000) {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			// Check if it's a connection error that we should retry
			const isRetryableError =
				error.message?.includes('other side closed') ||
				error.message?.includes('fetch failed') ||
				error.message?.includes('network') ||
				error.status === 0 ||
				error.code === 'UND_ERR_SOCKET';

			if (isRetryableError && attempt < maxRetries) {
				console.warn(`PocketBase operation failed (attempt ${attempt}/${maxRetries}):`, error.message);
			}

			if (attempt === maxRetries || !isRetryableError) {
				throw error;
			}
			
			// Wait before retrying with exponential backoff
			await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
		}
	}
}
