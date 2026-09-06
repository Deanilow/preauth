import https from 'node:https';

type TextResponse = {
	text(): Promise<string>;
};

export class HttpSupport {
	private static readonly httpsAgent = new https.Agent({
		rejectUnauthorized: false,
		keepAlive: true
	});

	static getHttpsAgent(useInsecure: boolean): https.Agent | undefined {
		console.log('HttpSupport.getHttpsAgent', { useInsecure });
		return useInsecure ? HttpSupport.httpsAgent : undefined;
	}

	static async parseResponseBody(response: TextResponse): Promise<unknown> {
		const rawBody = await response.text();
		try {
			if (rawBody === '') {
				return null;
			}

			return JSON.parse(rawBody);
		} catch {
			return rawBody;
		}
	}

	static normalizeBaseUrl(baseUrl: string): string {
		let normalized = baseUrl.replace(/\/$/, '');
		if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
			normalized = `https://${normalized}`;
		}
		return normalized;
	}
}