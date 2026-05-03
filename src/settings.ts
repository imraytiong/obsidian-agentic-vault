import { App, PluginSettingTab, Setting, Notice } from 'obsidian';

export interface AgenticVaultSettings {
	hasCompletedOnboarding: boolean;
	llmApiKey: string;
	projectsPath: string;
	areasPath: string;
	resourcesPath: string;
	archivesPath: string;
	sherpaPath: string;
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
	llmApiKey: '',
	projectsPath: '1 - Projects',
	areasPath: '2 - Areas',
	resourcesPath: '3 - Resources',
	archivesPath: '4 - Archives',
	sherpaPath: 'AgenticVault',
	sandboxEngine: 'local-node',
	customEnvPath: '/Users/raytiong/.nvm/versions/node/v24.11.0/bin:/usr/local/bin:/opt/homebrew/bin',
	llmProvider: 'gemini',
	llmModel: 'gemini-2.5-flash',
	llmBaseUrl: 'https://api.openai.com/v1',
	availableModels: ['gemini-2.5-flash', 'gemini-1.5-pro']
}

export class AgenticVaultSettingTab extends PluginSettingTab {
	plugin: any; // Using any to avoid circular import issues if needed, or import from main.ts

	constructor(app: App, plugin: any) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h2', {text: 'Agentic Vault Settings'});

		new Setting(containerEl)
			.setName('LLM API Key')
			.setDesc('API key for the conversational agents (e.g., OpenAI).')
			.addText(text => text
				.setPlaceholder('sk-...')
				.setValue(this.plugin.settings.llmApiKey)
				.onChange(async (value) => {
					this.plugin.settings.llmApiKey = value;
					await this.plugin.saveSettings();
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
				}));

		new Setting(containerEl)
			.setName('Test API Key & Fetch Models')
			.setDesc('Validate your connection and download the latest list of available models.')
			.addButton(button => button
				.setButtonText('Test Connection')
				.onClick(async () => {
					button.setButtonText('Testing...');
					try {
						let models: string[] = [];
						if (this.plugin.settings.llmProvider === 'openai') {
							const { OpenAIProvider } = await import('./llm/OpenAIProvider');
							models = await OpenAIProvider.fetchAvailableModels(this.plugin.settings.llmApiKey, this.plugin.settings.llmBaseUrl);
						} else {
							const { GeminiProvider } = await import('./llm/GeminiProvider');
							models = await GeminiProvider.fetchAvailableModels(this.plugin.settings.llmApiKey);
						}
						
						this.plugin.settings.availableModels = models;
						if (!models.includes(this.plugin.settings.llmModel) && models.length > 0) {
							this.plugin.settings.llmModel = models[0];
						}
						await this.plugin.saveSettings();
						new Notice(`Success: Found ${models.length} models.`);
						
						// Force re-render
						this.display();
					} catch (e: any) {
						new Notice(`API Error: ${e.message}`);
					} finally {
						button.setButtonText('Test Connection');
					}
				}));

		new Setting(containerEl)
			.setName('LLM Model')
			.setDesc('Select the model to use for inference.')
			.addDropdown(dropdown => {
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
			.setName('Projects Folder')
			.setDesc('Path for active projects.')
			.addText(text => text
				.setPlaceholder('1 - Projects')
				.setValue(this.plugin.settings.projectsPath)
				.onChange(async (value) => {
					this.plugin.settings.projectsPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Areas Folder')
			.setDesc('Path for active areas of responsibility.')
			.addText(text => text
				.setPlaceholder('2 - Areas')
				.setValue(this.plugin.settings.areasPath)
				.onChange(async (value) => {
					this.plugin.settings.areasPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Resources Folder')
			.setDesc('Path for resources and reference material.')
			.addText(text => text
				.setPlaceholder('3 - Resources')
				.setValue(this.plugin.settings.resourcesPath)
				.onChange(async (value) => {
					this.plugin.settings.resourcesPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Archives Folder')
			.setDesc('Path for completed or inactive items.')
			.addText(text => text
				.setPlaceholder('4 - Archives')
				.setValue(this.plugin.settings.archivesPath)
				.onChange(async (value) => {
					this.plugin.settings.archivesPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Sherpa Folder')
			.setDesc('Path for storing your Markdown persona definitions.')
			.addText(text => text
				.setPlaceholder('AgenticVault')
				.setValue(this.plugin.settings.sherpaPath)
				.onChange(async (value) => {
					this.plugin.settings.sherpaPath = value;
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
