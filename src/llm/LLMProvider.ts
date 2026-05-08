import { ToolDefinition } from "../sandbox/ToolRegistry";

export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
	raw?: unknown;
}

export interface LLMMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	persona?: string;
	toolCallId?: string;
	toolName?: string;
	toolCalls?: ToolCall[];
	rawParts?: unknown[];
	uiOptions?: {
		options: string[];
		type: 'single' | 'multiple';
		custom: boolean;
	};
	isError?: boolean;
	modelUsed?: string;
	executionTimeMs?: number;
}

export interface LLMResponse {
	content: string;
	toolCalls?: ToolCall[];
	rawParts?: unknown[];
	modelUsed?: string;
}

export interface LLMProviderOptions {
	allowFallback?: boolean;
	availableModels?: string[];
	modelOverride?: string;
	signal?: AbortSignal;
	tierModels?: Record<string, string>;
}

export interface LLMProvider {
	generateResponse(messages: LLMMessage[], tools: ToolDefinition[], options?: LLMProviderOptions): Promise<LLMResponse>;
}
