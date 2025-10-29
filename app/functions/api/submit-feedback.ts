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
				hostname === '127.0.0.1' ||
				hostname.startsWith('192.168.') || // ローカルネットワーク
				hostname.startsWith('10.') // ローカルネットワーク
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

	// Only accept POST requests
	if (request.method !== 'POST') {
		return new Response('Method Not Allowed', {
			status: 405,
			headers: corsHeaders
		});
	}

	try {
		const body = await request.json();
		const { type, title, content, email } = body;

		// Validation
		if (!type || (type !== 'inquiry' && type !== 'bug')) {
			return new Response(JSON.stringify({ error: 'Invalid category' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			});
		}

		if (!title || typeof title !== 'string' || title.trim().length === 0) {
			return new Response(JSON.stringify({ error: 'Title is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			});
		}

		if (title.length > 100) {
			return new Response(JSON.stringify({ error: 'Title must be 100 characters or less' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			});
		}

		if (!content || typeof content !== 'string' || content.trim().length === 0) {
			return new Response(JSON.stringify({ error: 'Content is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			});
		}

		if (content.length > 2000) {
			return new Response(JSON.stringify({ error: 'Content must be 2000 characters or less' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json', ...corsHeaders }
			});
		}

		// Email validation (if provided)
		if (email && typeof email === 'string' && email.trim().length > 0) {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(email)) {
				return new Response(JSON.stringify({ error: 'Invalid email format' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json', ...corsHeaders }
				});
			}
		}

		// Generate unique ID
		const timestamp = Date.now();
		const uuid = crypto.randomUUID();
		const id = `feedback:${timestamp}:${uuid}`;

		// Get user agent and IP country
		const userAgent = request.headers.get('User-Agent') || 'Unknown';
		const ipCountry = request.headers.get('CF-IPCountry') || 'Unknown';

		// Get locale from Accept-Language header
		const acceptLanguage = request.headers.get('Accept-Language') || 'en';
		const locale = acceptLanguage.split(',')[0].split('-')[0]; // Get primary language

		// Prepare feedback data
		const feedbackData = {
			id,
			type,
			title: title.trim(),
			content: content.trim(),
			email: email?.trim() || null,
			userAgent,
			locale,
			timestamp,
			ipCountry,
			status: '未対応'
		};

		// Store in KV
		await env.FEEDBACK_KV.put(id, JSON.stringify(feedbackData));

		// Send email notification to admin
		try {
			const adminEmail = env.ADMIN_EMAIL;
			if (adminEmail) {
				const emailSubject = `[Game Seeker Vault] 新規フィードバック: ${type === 'inquiry' ? 'お問い合わせ' : '不具合報告'}`;
				const emailBody = `
新しいフィードバックが送信されました。

カテゴリ: ${type === 'inquiry' ? 'お問い合わせ' : '不具合報告'}
タイトル: ${feedbackData.title}
詳細: ${feedbackData.content}
メールアドレス: ${feedbackData.email || 'なし'}
送信日時: ${new Date(timestamp).toISOString()}
ユーザーエージェント: ${userAgent}
国: ${ipCountry}
言語: ${locale}

管理画面: https://gameseekervault.pages.dev/admin?password=${env.ADMIN_PASSWORD}
`;

				await fetch('https://api.mailchannels.net/tx/v1/send', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						personalizations: [
							{
								to: [{ email: adminEmail }],
							},
						],
						from: {
							email: 'noreply@gameseekervault.pages.dev',
							name: 'Game Seeker Vault',
						},
						subject: emailSubject,
						content: [
							{
								type: 'text/plain',
								value: emailBody,
							},
						],
					}),
				});
			}
		} catch (emailError) {
			console.error('Failed to send email notification:', emailError);
			// Don't fail the request if email fails
		}

		return new Response(JSON.stringify({ success: true, id }), {
			status: 200,
			headers: { 'Content-Type': 'application/json', ...corsHeaders }
		});
	} catch (error) {
		console.error('Error processing feedback:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json', ...corsHeaders }
		});
	}
}
