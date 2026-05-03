import { requestUrl } from 'obsidian';
import { LLMMessage, LLMProvider, LLMResponse } from './LLMProvider';
import { ToolDefinition } from '../sandbox/ToolRegistry';

export class OpenAIProvider implements LLMProvider {
	private apiKey: string;
	private model: string;
	private baseUrl: string;

	constructor(apiKey: string, model: string, baseUrl: string) {
		this.apiKey = apiKey;
		this.model = model || 'gpt-4o-mini';
		this.baseUrl = baseUrl || 'https://api.openai.com/v1';
	}

	static async fetchAvailableModels(apiKey: string, baseUrl: string): Promise<string[]> {
		const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
		const url = `${base}/models`;
		const headers: Record<string, string> = {};
		if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

		const res = await requestUrl({ url, method: 'GET', headers });
		if (res.status !== 200) throw new Error(`API Error: ${res.status}`);
		
		const data = res.json;
		if (!data.data) return [];
		
		return data.data.map((m: any) => m.id);
	}

	async generateResponse(messages: LLMMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
		const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
		const url = `${base}/chat/completions`;
		
		const openaiMessages = messages.map(msg => {
			const m: any = { role: msg.role, content: msg.content };
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
			const properties: Record<string, any> = {};
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

		const body: any = {
			model: this.model,
			messages: openaiMessages
		};
		if (openaiTools) body.tools = openaiTools;

		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (this.apiKey) {
			headers['Authorization'] = `Bearer ${this.apiKey}`;
		}

		try {
			const res = await requestUrl({
				url,
				method: 'POST',
				headers,
				body: JSON.stringify(body)
			});

			if (res.status !== 200) {
				throw new Error(`OpenAI API Error: ${res.text}`);
			}

			const data = res.json;
			const message = data.choices?.[0]?.message;
			if (!message) throw new Error('No message returned from OpenAI provider');

			let toolCalls: any[] | undefined = undefined;
			if (message.tool_calls) {
				toolCalls = message.tool_calls.map((tc: any) => ({
					id: tc.id,
					name: tc.function.name,
					arguments: JSON.parse(tc.function.arguments)
				}));
			}

			return { content: message.content || '', toolCalls };
		} catch (error: any) {
			throw new Error(`OpenAI Provider Error: ${error.message}`);
		}
	}
}
