import { describe, it, expect } from 'vitest';
import { ModelResolver } from '../../src/llm/ModelResolver';

describe('ModelResolver Integration', () => {
    const availableModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.1-pro-preview', 'gpt-4o'];

    it('should resolve Reasoning to the highest available reasoning model', () => {
        const resolved = ModelResolver.resolveTargetModel('Reasoning', availableModels);
        expect(resolved).toBe('gemini-3.1-pro-preview');
    });

    it('should resolve Fast to the highest available fast model', () => {
        const resolved = ModelResolver.resolveTargetModel('Fast', availableModels);
        expect(resolved).toBe('gpt-4o');
    });

    it('should fallback correctly from Reasoning to Fast', () => {
        const fallback = ModelResolver.getFallbackModel('gemini-3.1-pro-preview', availableModels);
        expect(fallback).toBe('gpt-4o');
    });

    it('should pass through specific model IDs if not a category', () => {
        const resolved = ModelResolver.resolveTargetModel('gpt-4o', availableModels);
        expect(resolved).toBe('gpt-4o');
    });
});
