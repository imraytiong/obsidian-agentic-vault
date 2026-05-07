import { LLMMessage, LLMProvider, LLMResponse } from '../../../src/llm/LLMProvider';
import { ToolDefinition } from '../../../src/sandbox/ToolRegistry';

export class MockLLMProvider implements LLMProvider {
	private queuedResponses: LLMResponse[] = [];

	queueResponse(response: LLMResponse) {
		this.queuedResponses.push(response);
	}

	async generateResponse(messages: LLMMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
		if (this.queuedResponses.length > 0) {
			return this.queuedResponses.shift()!;
		}
		
		// Default fallback if nothing is queued
		return {
			content: "I am a mock LLM and I have no more queued responses."
		};
	}
}
