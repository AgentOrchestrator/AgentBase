/**
 * Check if a service is healthy by making HTTP requests
 */
export async function waitForHealthy(
	url: string,
	timeoutMs: number = 60000,
	intervalMs: number = 1000
): Promise<boolean> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeoutMs) {
		try {
			const response = await fetch(url, {
				method: 'GET',
				signal: AbortSignal.timeout(5000), // 5 second timeout per request
			});

			if (response.ok || response.status === 404) {
				// 404 is fine - means server is responding
				return true;
			}
		} catch (error) {
			// Service not ready yet, continue polling
		}

		// Wait before next attempt
		await new Promise(resolve => setTimeout(resolve, intervalMs));
	}

	return false;
}

/**
 * Check if Supabase is healthy
 */
export async function checkSupabaseHealth(url: string): Promise<boolean> {
	try {
		const response = await fetch(`${url}/rest/v1/`, {
			method: 'GET',
			signal: AbortSignal.timeout(5000),
		});
		return response.ok || response.status === 401; // 401 is fine - means auth is required
	} catch {
		return false;
	}
}
