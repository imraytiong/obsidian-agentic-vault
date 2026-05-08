import { LLMMessage, LLMProvider, LLMResponse, LLMProviderOptions, ToolCall } from './LLMProvider';
import { getErrorMessage } from '../utils/ErrorUtils';
import { ToolDefinition } from '../sandbox/ToolRegistry';
import type { INetwork } from '../core/interfaces/Environment';
import { ModelResolver } from './ModelResolver';

export class GeminiProvider implements LLMProvider {
	private apiKey: string;
	private model: string;
	private network: INetwork;
	private lastDumpPath?: string;

	constructor(apiKey: string, model: string, network: INetwork) {
		this.apiKey = apiKey;
		this.model = model;
		this.network = network;
	}

	static async fetchAvailableModels(apiKey: string, network: INetwork): Promise<string[]> {
		if (!apiKey) throw new Error("API Key required.");
		const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
		const res = await fetch(url, { method: 'GET' });
		if (res.status !== 200) throw new Error(`API Error: ${res.status}`);
		
		const data = await res.json() as { models?: { name: string }[] };
		if (!data.models) return [];
		
		return data.models
			.map((m: { name: string }) => m.name.replace('models/', ''))
			.filter((name: string) => name.includes('gemini'));
	}

	async generateResponse(messages: LLMMessage[], tools: ToolDefinition[], options?: LLMProviderOptions): Promise<LLMResponse> {
		const signal = options?.signal;
		let targetModel = this.model;
		if (options?.modelOverride) {
			targetModel = options.modelOverride;
		}
		
		if (!targetModel || ['Reasoning', 'Fast', 'Light'].includes(targetModel)) {
			console.log(`[DEBUG GeminiProvider] THROWING ERROR because targetModel is ${targetModel}`);
			throw new Error("No specific model selected. Please click 'Test Key & Load Models' in settings to populate the model list.");
		}
		
		let url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${this.apiKey}`;
		let systemInstruction: Record<string, unknown> | undefined = undefined;
		const contents: Record<string, unknown>[] = [];

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
				if (msg.rawParts) {
					contents.push({ role: 'model', parts: msg.rawParts });
				} else if (msg.toolCalls && msg.toolCalls.length > 0) {
					const parts = msg.toolCalls.map(tc => tc.raw || {
						functionCall: {
							name: tc.name,
							args: tc.arguments
						}
					});
					if (msg.content) parts.unshift({ text: msg.content });
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
		const mergedContents: Record<string, unknown>[] = [];
		for (const c of contents) {
			const last = mergedContents[mergedContents.length - 1];
			if (mergedContents.length > 0 && last && last.role === c.role) {
				const lastParts = last.parts as Record<string, unknown>[] | undefined;
				const cParts = c.parts as Record<string, unknown>[] | undefined;
				if (lastParts && cParts) {
					lastParts.push(...cParts);
				}
			} else {
				mergedContents.push(c);
			}
		}

		// Tool Declarations
		let geminiTools: Record<string, unknown>[] = [];
		if (tools && tools.length > 0) {
			const functionDeclarations = tools.map(t => {
				if (t.parameters && !Array.isArray(t.parameters) && typeof t.parameters === 'object') {
					// It's already a JSON schema! (MCP format)
					const geminiParams = JSON.parse(JSON.stringify(t.parameters));
					const traverseAndSanitize = (obj: any) => {
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
				for (const p of (t.parameters as Record<string, unknown>[] || [])) {
					const param = p as { name: string, type?: string, description?: string, required?: boolean, items?: { type?: string, properties?: unknown } };
					const typeStr = (param.type || 'string').toUpperCase();
					const prop: Record<string, unknown> = { type: typeStr, description: param.description || '' };
					if (typeStr === 'ARRAY') {
						if (param.items && param.items.type) {
							prop.items = { type: param.items.type.toUpperCase() };
							if (param.items.properties) (prop.items as Record<string, unknown>).properties = param.items.properties;
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

		const body: Record<string, unknown> = { contents: mergedContents };
		if (systemInstruction) body.systemInstruction = systemInstruction;
		if (geminiTools.length > 0) body.tools = geminiTools;

		try {
			console.log("Sending Gemini request...", body);
			


			const executeWithResilience = async (): Promise<{ res: Response, modelUsed: string }> => {
				let currentUrl = url;
				let currentModel = targetModel;
				let retries = 0;
				let lastError: Error | null = null;
				
				while (true) {
					try {
						let resStatus: number;
						let resText: string;
						let resJson: unknown = null;

						const fetchPromise = (async () => {
							if (this.network) {
								const resp = await this.network.request({
									url: currentUrl,
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify(body)
								});
								return { status: resp.status, text: resp.text, json: resp.json };
							} else {
								const res = await fetch(currentUrl, {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify(body)
								});
								const text = await res.text();
								return { status: res.status, text, json: null };
							}
						})();
						
						const timeoutPromise = new Promise<never>((_, reject) => {
							setTimeout(() => reject(new Error('Gemini API request timed out after 300 seconds. The reasoning model is still processing or the API is under heavy load.')), 300000);
						});
						
						const abortPromise = new Promise<never>((_, reject) => {
							if (signal) {
								if (signal.aborted) reject(new Error('Aborted by user.'));
								signal.addEventListener('abort', () => reject(new Error('Aborted by user.')));
							}
						});

						let res = await Promise.race([fetchPromise, timeoutPromise, abortPromise]);
						resStatus = res.status;
						resText = res.text;
						resJson = res.json;
						console.log(`Received Gemini response (${currentModel}):`, resStatus);

						if (resStatus === 429) {
							if (retries < 2) {
								retries++;
								const waitMs = retries * 2000;
								console.warn(`Gemini API rate limited (429). Retrying in ${waitMs}ms...`);
								await new Promise(r => setTimeout(r, waitMs));
								continue;
							}
						}

						if (resStatus === 503 || resStatus === 404 || resStatus === 403) {
							if (options?.allowFallback && options?.availableModels) {
								const fallbackModel = ModelResolver.getFallbackModel(currentModel, options.availableModels, options.tierModels);
								if (fallbackModel && fallbackModel !== currentModel) {
									console.warn(`Gemini API overloaded (${resStatus}) on ${currentModel}. Falling back to ${fallbackModel}...`);
									currentModel = fallbackModel;
									currentUrl = currentUrl.replace(/\/models\/[^\:]+:/, `/models/${fallbackModel}:`);
									continue;
								}
							}
						}

						if (resStatus !== 200) {
							let errText = resText;
							try {
								const parsed = JSON.parse(errText);
								if (parsed.error && parsed.error.message) errText = parsed.error.message;
							} catch (e) {}
							throw new Error(`Gemini API Error (${resStatus}): ${errText}`);
						}
						
						let finalJson = resJson;
						if (!finalJson) {
							finalJson = JSON.parse(resText);
						}
						
						return { res: { json: () => Promise.resolve(finalJson) } as any, modelUsed: currentModel };
					} catch (err: unknown) {
						const errMsg = getErrorMessage(err);
						if (errMsg.includes('timed out') || errMsg.includes('fetch failed')) {
							if (retries < 1) {
								retries++;
								console.warn(`Network error. Retrying... (${errMsg})`);
								await new Promise(r => setTimeout(r, 1000));
								continue;
							}
						}
						throw err;
					}
				}
			};

			let { res, modelUsed } = await executeWithResilience();

			const data = await res.json();
			


			const candidate = data.candidates?.[0];
			if (!candidate) throw new Error('No candidate returned from Gemini');

			const parts = candidate.content?.parts || [];
			
			let text = '';
			const toolCalls: ToolCall[] = [];

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

			return { content: text, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, rawParts: parts, modelUsed };
		} catch (error: unknown) {
			throw new Error(`Gemini Provider Error: ${getErrorMessage(error)}`);
		}
	}
}
