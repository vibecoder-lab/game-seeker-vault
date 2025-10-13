export async function onRequest(context): Promise<Response> {
	const { request, env } = context;

	// Allowed origins
	const allowedOrigins = [
		'https://gameseekervault.pages.dev',
		'http://localhost:8788',
		'http://localhost:3000',
	];

	const origin = request.headers.get('Origin');
	const allowedOrigin = allowedOrigins.find(allowed => origin === allowed) || allowedOrigins[0];

	// CORS headers
	const corsHeaders = {
		'Access-Control-Allow-Origin': allowedOrigin,
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};

	// Handle preflight requests
	if (request.method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders });
	}

	// Referer check: Only allow access from allowed origins
	const referer = request.headers.get('Referer');

	const isAllowed = allowedOrigins.some(allowed =>
		origin?.startsWith(allowed) || referer?.startsWith(allowed)
	);

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
