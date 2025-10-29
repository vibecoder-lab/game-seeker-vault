export async function onRequest(context): Promise<Response> {
	const { request, env } = context;

	// CORS headers
	const origin = request.headers.get('Origin');
	const corsHeaders = {
		'Access-Control-Allow-Origin': origin || 'https://gameseekervault.pages.dev',
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};

	// Handle preflight requests
	if (request.method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders });
	}

	// Only accept GET requests
	if (request.method !== 'GET') {
		return new Response('Method Not Allowed', {
			status: 405,
			headers: corsHeaders
		});
	}

	try {
		// Get password from query parameter
		const url = new URL(request.url);
		const password = url.searchParams.get('password');

		// Verify password
		if (!password || password !== env.ADMIN_PASSWORD) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			});
		}

		// Get all feedback from KV
		const list = await env.FEEDBACK_KV.list({ prefix: 'feedback:' });
		const feedbackItems = [];

		for (const key of list.keys) {
			const value = await env.FEEDBACK_KV.get(key.name);
			if (value) {
				try {
					const feedback = JSON.parse(value);
					feedbackItems.push(feedback);
				} catch (e) {
					console.error(`Failed to parse feedback ${key.name}:`, e);
				}
			}
		}

		// Sort by timestamp (newest first)
		feedbackItems.sort((a, b) => b.timestamp - a.timestamp);

		return new Response(JSON.stringify({ items: feedbackItems }), {
			status: 200,
			headers: { 'Content-Type': 'application/json', ...corsHeaders }
		});
	} catch (error) {
		console.error('Error listing feedback:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json', ...corsHeaders }
		});
	}
}
