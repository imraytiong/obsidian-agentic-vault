import { App, PluginSettingTab, Setting, Notice, debounce, DropdownComponent, ButtonComponent } from 'obsidian';
import { GeminiProvider } from './llm/GeminiProvider';
import { OpenAIProvider } from './llm/OpenAIProvider';

export interface ZoneDefinition {
	path: string;
	description: string;
}

export interface AgenticVaultSettings {
	hasCompletedOnboarding: boolean;
	rootFolder: string;
	llmApiKey: string;
	zones: Record<string, ZoneDefinition>;
	agenticVaultPath: string;
	sandboxEngine: string;
	customEnvPath: string;
	llmProvider: string;
	llmModel: string;
	llmBaseUrl: string;
	availableModels: string[];
	chatState?: {
		unifiedTimeline: import('./llm/LLMProvider').LLMMessage[];
		agentContexts: Record<string, import('./llm/LLMProvider').LLMMessage[]>;
	};
	tierModels: Record<string, string>;
	routinesEnabled: boolean;
}

export const DEFAULT_SETTINGS: AgenticVaultSettings = {
	hasCompletedOnboarding: false,
	rootFolder: '',
	llmApiKey: '',
	zones: {
		'inbox': { path: 'Inbox', description: 'Universal entry point for raw, unprocessed notes and ideas.' },
		'active_projects': { path: '10_projects', description: 'Active, ongoing projects with clear endpoints.' },
		'areas_of_responsibility': { path: '20_areas', description: 'Ongoing responsibilities and areas of focus without an end date.' },
		'knowledge_base': { path: '30_resources', description: 'Reference materials, articles, and useful knowledge.' },
		'archives': { path: '40_archives', description: 'Completed projects or inactive resources.' },
		'daily_logs': { path: 'Daily_Notes', description: 'Chronological tracking of daily work and reflections.' }
	},
	agenticVaultPath: 'agentic_vault',
	sandboxEngine: 'local-node',
	customEnvPath: '/Users/raytiong/.nvm/versions/node/v24.11.0/bin:/usr/local/bin:/opt/homebrew/bin',
	llmProvider: 'gemini',
	llmModel: '',
	llmBaseUrl: 'https://api.openai.com/v1',
	availableModels: [],
	tierModels: {
		Reasoning: '',
		Fast: '',
		Light: ''
	},
	routinesEnabled: false
}

import type AgenticVaultPlugin from './main';

export class AgenticVaultSettingTab extends PluginSettingTab {
	plugin: AgenticVaultPlugin;
	private tierDropdowns: Record<string, DropdownComponent> = {};
	private debouncedFetch: Function;

	constructor(app: App, plugin: AgenticVaultPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.debouncedFetch = debounce(async (apiKey: string) => {
			await this.performModelFetch(apiKey, false);
		}, 1500);
	}

	private async performModelFetch(apiKey: string, showNotice: boolean = false, buttonComponent?: ButtonComponent) {
		if (!apiKey) return;
		apiKey = apiKey.trim();
		try {
			if (buttonComponent) buttonComponent.setButtonText('Testing...');
			let models: string[] = [];
			if (this.plugin.settings.llmProvider === 'openai') {
				models = await OpenAIProvider.fetchAvailableModels(apiKey, this.plugin.settings.llmBaseUrl, this.plugin.context.network);
			} else {
				models = await GeminiProvider.fetchAvailableModels(apiKey, this.plugin.context.network);
			}
			
			this.plugin.settings.availableModels = models;
			
			if (models.length > 0) {
				const { ModelResolver } = require('./llm/ModelResolver');
				const bestModels = ModelResolver.getBestModelsForTiers(models);
				this.plugin.settings.tierModels = {
					Reasoning: bestModels.Reasoning,
					Fast: bestModels.Fast,
					Light: bestModels.Light
				};
			}
			
			await this.plugin.saveSettings();
			if (showNotice) new Notice(`Success: Found ${models.length} models.`);
			
			['Reasoning', 'Fast', 'Light'].forEach(tier => {
				const dropdown = this.tierDropdowns[tier];
				if (dropdown) {
					dropdown.selectEl.empty();
					dropdown.addOption('', 'Auto / Default Fallback');
					models.forEach(m => dropdown.addOption(m, m));
					dropdown.setValue(this.plugin.settings.tierModels[tier] || '');
				}
			});
		} catch (e: unknown) {
			if (showNotice) new Notice(`API Error: ${String(e)}`);
		} finally {
			if (buttonComponent) buttonComponent.setButtonText('Test Connection');
		}
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		new Setting(containerEl).setName("Agentic Vault Settings").setHeading();

		new Setting(containerEl)
			.setName('LLM API Key')
			.setDesc('API key for the conversational agents (e.g., OpenAI).')
			.addText(text => text
				.setPlaceholder('sk-...')
				.setValue(this.plugin.settings.llmApiKey)
				.onChange(async (value) => {
					this.plugin.settings.llmApiKey = value;
					await this.plugin.saveSettings();
					this.debouncedFetch(value);
				}));

		new Setting(containerEl)
			.setName('LLM Provider')
			.setDesc('Select the API provider for inference.')
			.addDropdown(dropdown => dropdown
				.addOption('gemini', 'Google Gemini (Native)')
				.addOption('openai', 'OpenAI Compatible (Ollama, LM Studio, etc)')
				.setValue(this.plugin.settings.llmProvider)
				.onChange(async (value) => {
					this.plugin.settings.llmProvider = value;
					await this.plugin.saveSettings();
					this.debouncedFetch(this.plugin.settings.llmApiKey);
				}));

		new Setting(containerEl)
			.setName('Enable Background Routines')
			.setDesc('Global kill-switch for automated CRON and event-based tasks.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.routinesEnabled)
				.onChange(async (value) => {
					this.plugin.settings.routinesEnabled = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Test API Key & Fetch Models')
			.setDesc('Validate your connection and download the latest list of available models.')
			.addButton(button => button
				.setButtonText('Test Connection')
				.onClick(async () => {
					await this.performModelFetch(this.plugin.settings.llmApiKey, true, button);
				}));

		new Setting(containerEl).setName("Model Tier Mappings").setHeading();
		containerEl.createEl('p', { 
			text: 'Map specific models to capability tiers. If auto/default is selected, the system will pick the best available model for that tier.',
			attr: { style: 'color: var(--text-muted); font-size: 0.9em; margin-bottom: 20px;' }
		});

		['Reasoning', 'Fast', 'Light'].forEach(tier => {
			new Setting(containerEl)
				.setName(`${tier} Tier Model`)
				.setDesc(`Used by agents requesting ${tier} capabilities.`)
				.addDropdown(dropdown => {
					this.tierDropdowns[tier] = dropdown;
					const models = this.plugin.settings.availableModels || [];
					dropdown.addOption('', 'Auto / Default Fallback');
					models.forEach((m: string) => dropdown.addOption(m, m));
					dropdown.setValue(this.plugin.settings.tierModels[tier] || '')
						.onChange(async (value) => {
							this.plugin.settings.tierModels[tier] = value;
							await this.plugin.saveSettings();
						});
				});
		});

		new Setting(containerEl)
			.setName('LLM Base URL (OpenAI Compatible Only)')
			.setDesc('Custom endpoint for local inference (e.g. http://localhost:11434/v1)')
			.addText(text => text
				.setPlaceholder('https://api.openai.com/v1')
				.setValue(this.plugin.settings.llmBaseUrl)
				.onChange(async (value) => {
					this.plugin.settings.llmBaseUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Root Folder')
			.setDesc('Optional root folder to place the PARA structure under (leave empty for vault root).')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.rootFolder)
				.onChange(async (value) => {
					this.plugin.settings.rootFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName("Dynamic Zones").setHeading();
		containerEl.createEl('p', { 
			text: 'Semantic zones allow conversational agents to understand your organization structure without hardcoded paths.',
			attr: { style: 'color: var(--text-muted); font-size: 0.9em; margin-bottom: 20px;' }
		});

		Object.entries(this.plugin.settings.zones).forEach(([zoneId, zoneDef]) => {
			new Setting(containerEl)
				.setName(`Zone: ${zoneId}`)
				.setDesc(`Semantic Purpose: ${zoneDef.description}`)
				.addText(text => text
					.setPlaceholder('Vault Path...')
					.setValue(zoneDef.path)
					.onChange(async (value) => {
						if (this.plugin.settings.zones[zoneId]) {
							this.plugin.settings.zones[zoneId].path = value;
							await this.plugin.saveSettings();
						}
					}));
		});

		new Setting(containerEl)
			.setName('Agentic Vault Folder')
			.setDesc('Path for storing your Agentic Vault configuration, personas, and tools.')
			.addText(text => text
				.setPlaceholder('90_agentic_vault')
				.setValue(this.plugin.settings.agenticVaultPath)
				.onChange(async (value) => {
					this.plugin.settings.agenticVaultPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Execution Sandbox Engine')
			.setDesc('Choose the engine used to run local tool scripts.')
			.addDropdown(dropdown => dropdown
				.addOption('local-node', 'Local Node.js Process')
				.addOption('docker', 'Docker Container')
				.addOption('podman', 'Podman Container')
				.setValue(this.plugin.settings.sandboxEngine)
				.onChange(async (value) => {
					this.plugin.settings.sandboxEngine = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Custom Environment PATH')
			.setDesc('Inject paths for NVM, Homebrew, or Conda since the GUI app cannot access your .zshrc.')
			.addText(text => text
				.setPlaceholder('/usr/local/bin:/opt/homebrew/bin')
				.setValue(this.plugin.settings.customEnvPath)
				.onChange(async (value) => {
					this.plugin.settings.customEnvPath = value;
					await this.plugin.saveSettings();
				}));
	}
}
