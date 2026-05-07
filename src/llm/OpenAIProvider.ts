import { LLMMessage, LLMProvider, LLMResponse } from './LLMProvider';
import { ToolDefinition } from '../sandbox/ToolRegistry';
import type { INetwork } from '../core/interfaces/Environment';

export class OpenAIProvider implements LLMProvider {
	private apiKey: string;
	private model: string;
	private baseUrl: string;
	private network: INetwork;

	constructor(apiKey: string, model: string, baseUrl: string, network: INetwork) {
		this.apiKey = apiKey;
		this.model = model || 'gpt-4o-mini';
		this.baseUrl = baseUrl || 'https://api.openai.com/v1';
		this.network = network;
	}

	static async fetchAvailableModels(apiKey: string, baseUrl: string, network: INetwork): Promise<string[]> {
		const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
		const url = `${base}/models`;
		const headers: Record<string, string> = {};
		if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

		const res = await network.request({ url, method: 'GET', headers });
		if (res.status !== 200) throw new Error(`API Error: ${res.status}`);
		
		const data = res.json;
		if (!data.data) return [];
		
		return data.data.map((m: unknown) => m.id);
	}

	async generateResponse(messages: LLMMessage[], tools: ToolDefinition[], signal?: AbortSignal): Promise<LLMResponse> {
		const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
		const url = `${base}/chat/completions`;
		
		const openaiMessages = messages.map(msg => {
			const m: unknown = { role: msg.role, content: msg.content };
			if (msg.role === 'assistant' && msg.toolCalls) {
				m.tool_calls = msg.toolCalls.map(tc => ({
					id: tc.id,
					type: 'function',
					function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
				}));
			}
			if (msg.role === 'tool') {
				m.tool_call_id = msg.toolCallId;
				m.name = msg.toolName;
			}
			return m;
		});

		const openaiTools = tools.length > 0 ? tools.map(t => {
			if (t.parameters && !Array.isArray(t.parameters) && typeof t.parameters === 'object') {
				// It's already a JSON schema! (MCP format)
				return {
					type: 'function',
					function: {
						name: t.name,
						description: t.description,
						parameters: t.parameters
					}
				};
			}

			// Otherwise, it's our legacy local sandbox array format
			const properties: Record<string, unknown> = {};
			const required: string[] = [];
			for (const param of (t.parameters || [])) {
				properties[param.name] = { type: param.type || 'string', description: param.description || '' };
				if (param.required) required.push(param.name);
			}
			return {
				type: 'function',
				function: {
					name: t.name,
					description: t.description,
					parameters: { type: 'object', properties, required }
				}
			};
		}) : undefined;

		const body: unknown = {
			model: this.model,
			messages: openaiMessages
		};
		if (openaiTools) body.tools = openaiTools;

		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (this.apiKey) {
			headers['Authorization'] = `Bearer ${this.apiKey}`;
		}

		try {
			const fetchPromise = this.network.request({
				url,
				method: 'POST',
				headers,
				body: JSON.stringify(body)
			});
			
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error('OpenAI API request timed out after 300 seconds. Generation may have been too large or the API is under heavy load.')), 300000);
			});
			
			const abortPromise = new Promise<never>((_, reject) => {
				if (signal) {
					if (signal.aborted) reject(new Error('Aborted by user.'));
					signal.addEventListener('abort', () => reject(new Error('Aborted by user.')));
				}
			});

			const res = await Promise.race([fetchPromise, timeoutPromise, abortPromise]) as any;

			if (res.status !== 200) {
				throw new Error(`OpenAI API Error: ${res.text}`);
			}

			const data = res.json;
			const message = data.choices?.[0]?.message;
			if (!message) throw new Error('No message returned from OpenAI provider');

			let toolCalls: unknown[] | undefined = undefined;
			if (message.tool_calls) {
				toolCalls = message.tool_calls.map((tc: unknown) => ({
					id: tc.id,
					name: tc.function.name,
					arguments: JSON.parse(tc.function.arguments)
				}));
			}

			return { content: message.content || '', toolCalls };
		} catch (error: unknown) {
			throw new Error(`OpenAI Provider Error: ${error.message}`);
		}
	}
}
