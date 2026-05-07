import { describe, it, expect, vi } from 'vitest';
import { PromptCompiler } from '../../src/core/PromptCompiler';

describe('PromptCompiler', () => {
	it('should compile system prompt correctly with minimal data', async () => {
		const mockPlugin: any = {
			settings: { zones: {} },
			personaEngine: {
				getPersonaByName: vi.fn().mockReturnValue({ systemPrompt: 'Test Prompt' }),
				getAllPersonas: vi.fn().mockReturnValue([])
			},
			skillsEngine: {
				getSkillCatalog: vi.fn().mockReturnValue([])
			},
			app: {
				vault: {
					adapter: {
						exists: vi.fn().mockResolvedValue(false)
					}
				}
			}
		};

		const result = await PromptCompiler.compileSystemPrompt(mockPlugin, 'Concierge');
		
		expect(result).toContain('Test Prompt');
		expect(result).toContain('[System Context]');
		expect(result).toContain('[Active Semantic Zones]');
		expect(result).toContain('[System Rules]');
	});

	it('should include shared and persona memory if files exist', async () => {
		const mockPlugin: any = {
			settings: { zones: {} },
			personaEngine: {
				getPersonaByName: vi.fn().mockReturnValue({ systemPrompt: 'Test Prompt' }),
				getAllPersonas: vi.fn().mockReturnValue([])
			},
			skillsEngine: {
				getSkillCatalog: vi.fn().mockReturnValue([])
			},
			app: {
				vault: {
					adapter: {
						exists: vi.fn().mockResolvedValue(true),
						read: vi.fn((path) => {
							if (path.includes('shared_memory')) return Promise.resolve('Global Fact 1');
							if (path.includes('bob_memory')) return Promise.resolve('Bob Fact 1');
							return Promise.resolve('');
						})
					}
				}
			}
		};

		const result = await PromptCompiler.compileSystemPrompt(mockPlugin, 'Bob');
		
		expect(result).toContain('[Global User Profile (Core Identity)]');
		expect(result).toContain('Global Fact 1');
		expect(result).toContain('[Persona-Specific Context]');
		expect(result).toContain('Bob Fact 1');
	});

	it('should list available skills if any exist', async () => {
		const mockPlugin: any = {
			settings: { zones: {} },
			personaEngine: {
				getPersonaByName: vi.fn().mockReturnValue(null),
				getAllPersonas: vi.fn().mockReturnValue([])
			},
			skillsEngine: {
				getSkillCatalog: vi.fn().mockReturnValue([
					{ id: 'test_skill', name: 'Test Skill', description: 'A skill for testing' }
				])
			},
			app: {
				vault: {
					adapter: {
						exists: vi.fn().mockResolvedValue(false)
					}
				}
			}
		};

		const result = await PromptCompiler.compileSystemPrompt(mockPlugin, 'Missing');
		
		expect(result).toContain('You are a helpful assistant.'); // Fallback prompt
		expect(result).toContain('[Available Skills Catalog]');
		expect(result).toContain('- **test_skill** (Test Skill): A skill for testing');
	});
});
