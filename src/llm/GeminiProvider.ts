import { LLMMessage, LLMProvider, LLMResponse } from './LLMProvider';
import { ToolDefinition } from '../sandbox/ToolRegistry';
import type { INetwork } from '../core/interfaces/Environment';

export class GeminiProvider implements LLMProvider {
	private apiKey: string;
	private model: string;
	private network: INetwork;
	private lastDumpPath?: string;

	constructor(apiKey: string, model: string = 'gemini-2.5-flash', network: INetwork) {
		this.apiKey = apiKey;
		this.model = model || 'gemini-2.5-flash';
		this.network = network;
	}

	static async fetchAvailableModels(apiKey: string, network: INetwork): Promise<string[]> {
		if (!apiKey) throw new Error("API Key required.");
		const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
		const res = await network.request({ url, method: 'GET' });
		if (res.status !== 200) throw new Error(`API Error: ${res.status}`);
		
		const data = res.json;
		if (!data.models) return [];
		
		return data.models
			.map((m: unknown) => m.name.replace('models/', ''))
			.filter((name: string) => name.includes('gemini'));
	}

	async generateResponse(messages: LLMMessage[], tools: ToolDefinition[], signal?: AbortSignal): Promise<LLMResponse> {
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
		
		let systemInstruction: unknown = undefined;
		const contents: unknown[] = [];

		for (const msg of messages) {
			if (msg.role === 'system') {
				if (!systemInstruction) {
					systemInstruction = { parts: [{ text: msg.content }] };
				} else {
					contents.push({ role: 'user', parts: [{ text: `[SYSTEM EVENT]: ${msg.content}` }] });
				}
			} else if (msg.role === 'user') {
				contents.push({ role: 'user', parts: [{ text: msg.content }] });
			} else if (msg.role === 'assistant') {
				if (msg.toolCalls && msg.toolCalls.length > 0) {
					const parts = msg.toolCalls.map(tc => tc.raw || {
						functionCall: {
							name: tc.name,
							args: tc.arguments
						}
					});
					if (msg.content) parts.unshift({ text: msg.content } as unknown);
					contents.push({ role: 'model', parts });
				} else {
					contents.push({ role: 'model', parts: [{ text: msg.content || '' }] });
				}
			} else if (msg.role === 'tool') {
				let parsedOutput: Record<string, unknown> = { output: msg.content };
				try {
					const parsed = JSON.parse(msg.content);
					if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
						parsedOutput = parsed;
					} else {
						parsedOutput = { output: parsed };
					}
				} catch {
					parsedOutput = { output: msg.content };
				}

				contents.push({
					role: 'function',
					parts: [{
						functionResponse: {
							name: msg.toolName,
							response: parsedOutput
						}
					}]
				});
			}
		}

		// Merge consecutive roles
		const mergedContents: any[] = [];
		for (const c of contents as any[]) {
			if (mergedContents.length > 0 && mergedContents[mergedContents.length - 1].role === c.role) {
				mergedContents[mergedContents.length - 1].parts.push(...c.parts);
			} else {
				mergedContents.push(c);
			}
		}

		// Tool Declarations
		let geminiTools: unknown[] = [];
		if (tools && tools.length > 0) {
			const functionDeclarations = tools.map(t => {
				if (t.parameters && !Array.isArray(t.parameters) && typeof t.parameters === 'object') {
					// It's already a JSON schema! (MCP format)
					const geminiParams = JSON.parse(JSON.stringify(t.parameters));
					const traverseAndSanitize = (obj: unknown) => {
						if (!obj || typeof obj !== 'object') return;
						if (obj.$schema !== undefined) delete obj.$schema;
						if (obj.additionalProperties !== undefined) delete obj.additionalProperties;
						if (obj.type && typeof obj.type === 'string') {
							obj.type = obj.type.toUpperCase();
						}
						Object.values(obj).forEach(traverseAndSanitize);
					};
					traverseAndSanitize(geminiParams);
					
					return {
						name: t.name,
						description: t.description,
						parameters: geminiParams
					};
				}

				// Otherwise, it's our legacy local sandbox array format
				const properties: Record<string, unknown> = {};
				const required: string[] = [];
				for (const param of (t.parameters || [])) {
					const typeStr = (param.type || 'string').toUpperCase();
					const prop: any = { type: typeStr, description: param.description || '' };
					if (typeStr === 'ARRAY') {
						if (param.items && param.items.type) {
							prop.items = { type: param.items.type.toUpperCase() };
							if (param.items.properties) prop.items.properties = param.items.properties;
						} else {
							prop.items = { type: 'STRING' };
						}
					}
					properties[param.name] = prop;
					if (param.required) required.push(param.name);
				}
				return {
					name: t.name,
					description: t.description,
					parameters: {
						type: 'OBJECT',
						properties,
						required
					}
				};
			});
			geminiTools = [{ functionDeclarations }];
		}

		const body: any = { contents: mergedContents };
		if (systemInstruction) body.systemInstruction = systemInstruction;
		if (geminiTools.length > 0) body.tools = geminiTools;

		try {
			console.log("Sending Gemini request...", body);
			


			const fetchPromise = this.network.request({
				url,
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error('Gemini API request timed out after 300 seconds. The reasoning model is still processing or the API is under heavy load.')), 300000);
			});
			
			const abortPromise = new Promise<never>((_, reject) => {
				if (signal) {
					if (signal.aborted) reject(new Error('Aborted by user.'));
					signal.addEventListener('abort', () => reject(new Error('Aborted by user.')));
				}
			});

			const res = await Promise.race([fetchPromise, timeoutPromise, abortPromise]) as any;
			console.log("Received Gemini response:", res.status);

			if (res.status !== 200) {
				throw new Error(`Gemini API Error: ${res.text}`);
			}

			const data = res.json;
			


			const candidate = data.candidates?.[0];
			if (!candidate) throw new Error('No candidate returned from Gemini');

			const parts = candidate.content?.parts || [];
			
			let text = '';
			const toolCalls: unknown[] = [];

			for (const part of parts) {
				if (part.text) text += part.text;
				if (part.functionCall) {
					toolCalls.push({
						id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
						name: part.functionCall.name,
						arguments: part.functionCall.args,
						raw: part
					});
				}
			}

			return { content: text, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
		} catch (error: unknown) {
			throw new Error(`Gemini Provider Error: ${error.message}`);
		}
	}
}
