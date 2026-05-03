import { ToolDefinition } from "../sandbox/ToolRegistry";

export interface LLMMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	persona?: string;
	toolCallId?: string;
	toolName?: string;
	toolCalls?: { id: string, name: string, arguments: unknown, raw?: unknown }[];
}

export interface LLMResponse {
	content: string;
	toolCalls?: { id: string, name: string, arguments: unknown, raw?: unknown }[];
}

export interface LLMProvider {
	generateResponse(messages: LLMMessage[], tools: ToolDefinition[]): Promise<LLMResponse>;
}
