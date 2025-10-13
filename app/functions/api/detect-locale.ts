export async function onRequest(context): Promise<Response> {
	const { request } = context;

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
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};

	// Handle preflight requests
	if (request.method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders });
	}

	// Referer check: only allow access from permitted origins
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
		// Get country code from Cloudflare's geo information
		const country = (request as any).cf?.country || 'US';

		// Get browser's Accept-Language header
		const acceptLanguage = request.headers.get('Accept-Language') || 'en';
		const browserLang = acceptLanguage.split(',')[0].split('-')[0];

		// Map country codes to language codes
		const countryToLang: Record<string, string> = {
			'JP': 'ja',  // Japan
			'US': 'en',  // United States
			'GB': 'en',  // United Kingdom
			'CA': 'en',  // Canada
			'AU': 'en',  // Australia
			'NZ': 'en',  // New Zealand
			'IE': 'en',  // Ireland
			'KR': 'ko',  // South Korea
			'CN': 'zh',  // China
			'TW': 'zh',  // Taiwan
			'HK': 'zh',  // Hong Kong
			'FR': 'fr',  // France
			'DE': 'de',  // Germany
			'ES': 'es',  // Spain
			'IT': 'it',  // Italy
			'PT': 'pt',  // Portugal
			'BR': 'pt',  // Brazil
			'RU': 'ru',  // Russia
			'PL': 'pl',  // Poland
			'NL': 'nl',  // Netherlands
			'SE': 'sv',  // Sweden
			'NO': 'no',  // Norway
			'DK': 'da',  // Denmark
			'FI': 'fi',  // Finland
			'TR': 'tr',  // Turkey
			'TH': 'th',  // Thailand
			'VN': 'vi',  // Vietnam
			'ID': 'id',  // Indonesia
			'MY': 'ms',  // Malaysia
			'SG': 'en',  // Singapore
			'PH': 'en',  // Philippines
			'IN': 'en',  // India
		};

		const suggestedLang = countryToLang[country] || 'en';

		return new Response(JSON.stringify({
			country,
			suggestedLang,
			browserLang,
			acceptLanguage
		}), {
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			},
		});
	} catch (error) {
		console.error('Error detecting locale:', error);
		return new Response(JSON.stringify({
			country: 'US',
			suggestedLang: 'en',
			browserLang: 'en',
			error: 'Failed to detect locale'
		}), {
			status: 200, // Return 200 with fallback values
			headers: {
				'Content-Type': 'application/json',
				...corsHeaders
			}
		});
	}
}
