export async function onRequest(context): Promise<Response> {
	const { request, env } = context;

	// Check if origin is allowed
	const origin = request.headers.get('Origin');
	const referer = request.headers.get('Referer');

	const isAllowedOrigin = (url: string | null): boolean => {
		if (!url) return false;
		try {
			const parsedUrl = new URL(url);
			const hostname = parsedUrl.hostname;
			return (
				hostname === 'gameseekervault.pages.dev' ||
				hostname.endsWith('.gameseekervault.pages.dev') ||
				hostname === 'localhost' ||
				hostname === '127.0.0.1'
			);
		} catch {
			return false;
		}
	};

	const isAllowed = isAllowedOrigin(origin) || isAllowedOrigin(referer);

	// CORS headers
	const corsHeaders = {
		'Access-Control-Allow-Origin': origin || 'https://gameseekervault.pages.dev',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};

	// Handle preflight requests
	if (request.method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders });
	}

	// Reject unauthorized origins
	if (!isAllowed) {
		return new Response('Forbidden', {
			status: 403,
			headers: corsHeaders
		});
	}

	try {
		const raw = await env.GSV_GAMES.get("games-data");
		if (!raw) {
			return new Response("No data found", {
				status: 404,
				headers: corsHeaders
			});
		}
		const data = JSON.parse(raw);

		console.log("KV games-data head:", raw?.slice(0, 120));

		return new Response(JSON.stringify(data), {
			headers: {
				"Content-Type": "application/json",
				...corsHeaders
			},
		});
	} catch (error) {
		console.error("Error fetching games data:", error);
		return new Response("Internal Server Error", {
			status: 500,
			headers: corsHeaders
		});
	}
}
