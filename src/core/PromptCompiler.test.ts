import { test, describe } from 'node:test';
import assert from 'node:assert';
import { PromptCompiler } from './PromptCompiler';

describe('PromptCompiler', () => {
    test('compiles system prompt with Me.md core identity', async () => {
        const mockPlugin = {
            personaEngine: {
                getPersonaByName: (name: string) => ({
                    name,
                    systemPrompt: 'Mock Base Prompt',
                    description: 'Mock Description'
                }),
                getAllPersonas: () => []
            },
            settings: {
                zones: {
                    inbox: { path: '00_Inbox', description: 'Mock Inbox' }
                }
            },
            app: {
                vault: {
                    adapter: {
                        exists: async (path: string) => {
                            if (path === '10_Strategy/Me.md') return true;
                            return false;
                        },
                        read: async (path: string) => {
                            if (path === '10_Strategy/Me.md') return 'MOCK_CORE_IDENTITY_CONTENT';
                            return '';
                        }
                    }
                }
            },
            skillsEngine: {
                getSkillCatalog: () => []
            }
        };

        const result = await PromptCompiler.compileSystemPrompt(mockPlugin as unknown as import('../main').default, 'Concierge');
        
        assert.ok(result.includes('Mock Base Prompt'), 'Should include base prompt');
        assert.ok(result.includes('MOCK_CORE_IDENTITY_CONTENT'), 'Should inject Me.md content');
        assert.ok(result.includes('update_profile'), 'Should reference the new update_profile tool in rules');
        assert.ok(result.includes('[Active Semantic Zones]'), 'Should include active semantic zones');
    });

    test('compiles system prompt without Me.md if it does not exist', async () => {
        const mockPlugin = {
            personaEngine: {
                getPersonaByName: (name: string) => ({
                    name,
                    systemPrompt: 'Mock Base Prompt',
                    description: 'Mock Description'
                }),
                getAllPersonas: () => []
            },
            settings: {
                zones: {}
            },
            app: {
                vault: {
                    adapter: {
                        exists: async () => false,
                        read: async () => ''
                    }
                }
            },
            skillsEngine: {
                getSkillCatalog: () => []
            }
        };

        const result = await PromptCompiler.compileSystemPrompt(mockPlugin as unknown as import('../main').default, 'Concierge');
        
        assert.ok(!result.includes('\n\n[Global User Profile (Core Identity)]\n'), 'Should NOT inject Core Identity block if Me.md missing');
        assert.ok(result.includes('update_profile'), 'Should still reference the update_profile tool in rules');
    });
});
