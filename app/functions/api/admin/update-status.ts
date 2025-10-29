export async function onRequest(context): Promise<Response> {
	const { request, env } = context;

	// CORS headers
	const origin = request.headers.get('Origin');
	const corsHeaders = {
		'Access-Control-Allow-Origin': origin || 'https://gameseekervault.pages.dev',
		'Access-Control-Allow-Methods': 'PUT, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};

	// Handle preflight requests
	if (request.method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders });
	}

	// Only accept PUT requests
	if (request.method !== 'PUT') {
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

		const body = await request.json();
		const { id, status } = body;

		// Validation
		if (!id || !status) {
			return new Response(JSON.stringify({ error: 'ID and status are required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			});
		}

		if (!['未対応', '対応中', '完了'].includes(status)) {
			return new Response(JSON.stringify({ error: 'Invalid status' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			});
		}

		// Get existing feedback
		const existing = await env.FEEDBACK_KV.get(id);
		if (!existing) {
			return new Response(JSON.stringify({ error: 'Feedback not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			});
		}

		// Update status
		const feedbackData = JSON.parse(existing);
		feedbackData.status = status;

		// Save back to KV
		await env.FEEDBACK_KV.put(id, JSON.stringify(feedbackData));

		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json', ...corsHeaders }
		});
	} catch (error) {
		console.error('Error updating status:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json', ...corsHeaders }
		});
	}
}
