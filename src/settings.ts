import { App, PluginSettingTab, Setting, Notice, debounce, DropdownComponent, ButtonComponent } from 'obsidian';

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
		unifiedTimeline: any[];
		agentContexts: Record<string, any[]>;
	};
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
	llmModel: 'gemini-2.5-flash',
	llmBaseUrl: 'https://api.openai.com/v1',
	availableModels: ['gemini-2.5-flash', 'gemini-1.5-pro']
}

import type AgenticVaultPlugin from './main';

export class AgenticVaultSettingTab extends PluginSettingTab {
	plugin: AgenticVaultPlugin;
	private modelDropdown: DropdownComponent | null = null;
	private debouncedFetch: Function;

	constructor(app: App, plugin: AgenticVaultPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.debouncedFetch = debounce(async (apiKey: string) => {
			await this.performModelFetch(apiKey, false);
		}, 1500, true);
	}

	private async performModelFetch(apiKey: string, showNotice: boolean = false, buttonComponent?: ButtonComponent) {
		if (!apiKey) return;
		try {
			if (buttonComponent) buttonComponent.setButtonText('Testing...');
			let models: string[] = [];
			if (this.plugin.settings.llmProvider === 'openai') {
				const { OpenAIProvider } = await import('./llm/OpenAIProvider');
				models = await OpenAIProvider.fetchAvailableModels(apiKey, this.plugin.settings.llmBaseUrl);
			} else {
				const { GeminiProvider } = await import('./llm/GeminiProvider');
				models = await GeminiProvider.fetchAvailableModels(apiKey);
			}
			
			this.plugin.settings.availableModels = models;
			
			if (models.length > 0) {
				const getBestModel = (models: string[]) => {
					// Dynamic sorting logic to automatically bubble up the latest, most capable model
					return [...models].sort((a, b) => {
						// 1. Extract semantic version (e.g., "2.5" from "gemini-2.5-pro", "4" from "gpt-4")
						const getV = (str: string) => parseFloat(str.match(/[\d]+(?:\.[\d]+)?/)?.[0] || '0');
						const vA = getV(a);
						const vB = getV(b);
						if (vA !== vB) return vB - vA; // Higher version wins
						
						// 2. Capability Tiering
						const tierWeight = (m: string) => {
							const lower = m.toLowerCase();
							if (lower.includes('pro') || lower.includes('plus') || lower.includes('opus') || lower.includes('gpt-4o') || lower.includes('o1') || lower.includes('o3')) return 3;
							if (lower.includes('flash') || lower.includes('sonnet') || lower.includes('turbo')) return 2;
							if (lower.includes('haiku') || lower.includes('mini')) return 1;
							return 0;
						};
						const wA = tierWeight(a);
						const wB = tierWeight(b);
						if (wA !== wB) return wB - wA; // Higher tier wins
						
						// 3. Prefer Stable over Experimental/Preview
						const isExpA = a.toLowerCase().includes('exp') || a.toLowerCase().includes('preview');
						const isExpB = b.toLowerCase().includes('exp') || b.toLowerCase().includes('preview');
						if (isExpA !== isExpB) return isExpA ? 1 : -1;
						
						// 4. Shorter string length wins (prefers base aliases like "gemini-2.0-flash" over "gemini-2.0-flash-001")
						return a.length - b.length;
					})[0] || models[0];
				};
				this.plugin.settings.llmModel = getBestModel(models);
			}
			
			await this.plugin.saveSettings();
			if (showNotice) new Notice(`Success: Found ${models.length} models.`);
			
			if (this.modelDropdown) {
				this.modelDropdown.selectEl.empty();
				models.forEach(m => this.modelDropdown?.addOption(m, m));
				this.modelDropdown.setValue(this.plugin.settings.llmModel);
			}
		} catch (e: any) {
			if (showNotice) new Notice(`API Error: ${e.message}`);
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
			.setName('Test API Key & Fetch Models')
			.setDesc('Validate your connection and download the latest list of available models.')
			.addButton(button => button
				.setButtonText('Test Connection')
				.onClick(async () => {
					await this.performModelFetch(this.plugin.settings.llmApiKey, true, button);
				}));

		new Setting(containerEl)
			.setName('LLM Model')
			.setDesc('Select the model to use for inference.')
			.addDropdown(dropdown => {
				this.modelDropdown = dropdown;
				const models = this.plugin.settings.availableModels || [];
				if (models.length === 0) {
					dropdown.addOption(this.plugin.settings.llmModel, this.plugin.settings.llmModel);
				} else {
					models.forEach((m: string) => dropdown.addOption(m, m));
				}
				
				dropdown.setValue(this.plugin.settings.llmModel)
					.onChange(async (value) => {
						this.plugin.settings.llmModel = value;
						await this.plugin.saveSettings();
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

		containerEl.createEl('h3', { text: 'Dynamic Zones' });
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
