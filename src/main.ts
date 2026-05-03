import { Plugin } from 'obsidian';
import { AgenticVaultSettings, DEFAULT_SETTINGS, AgenticVaultSettingTab } from "./settings";
// Removed OnboardingModal
import { ChatService } from "./services/ChatService";
import { LoggerService } from "./services/LoggerService";
import { AgenticVaultChatView, VIEW_TYPE_CAREER_SHERPA_CHAT } from "./ui/ChatView";
import { PersonaEngine } from "./core/PersonaEngine";
import { SkillsEngine } from "./core/SkillsEngine";
import { TriggerParser } from "./core/TriggerParser";
import { ToolRegistry } from "./sandbox/ToolRegistry";
import { ExecutionSandbox } from "./sandbox/ExecutionSandbox";
import { McpEngine } from "./core/McpEngine";

export default class AgenticVaultPlugin extends Plugin {
	settings: AgenticVaultSettings;
	chatService: ChatService;
	logger: LoggerService;
	personaEngine: PersonaEngine;
	skillsEngine: SkillsEngine;
	mcpEngine: McpEngine;
	triggerParser: TriggerParser;
	toolRegistry: ToolRegistry;
	executionSandbox: ExecutionSandbox;

	async onload() {
		console.debug("Agentic Vault AI is loading...");
		await this.loadSettings();

		// Initialize services
		this.logger = new LoggerService(this.app, this.settings.agenticVaultPath);
		this.personaEngine = new PersonaEngine(this.app, this.settings.agenticVaultPath);
		this.toolRegistry = new ToolRegistry(this.app, this.settings.agenticVaultPath);
		this.executionSandbox = new ExecutionSandbox(this.app, this.logger, this.toolRegistry, this.settings.sandboxEngine, this.settings.customEnvPath);
		this.skillsEngine = new SkillsEngine(this.app, this.settings.agenticVaultPath);
		this.mcpEngine = new McpEngine(this.app, this.settings.agenticVaultPath, this.settings.customEnvPath);
		this.chatService = new ChatService(this);
		this.triggerParser = new TriggerParser(this.app, this.logger, this.executionSandbox);

		// Initialize dynamic content
		this.app.workspace.onLayoutReady(async () => {
			await this.personaEngine.loadPersonas();
			await this.toolRegistry.loadTools();
			await this.skillsEngine.loadSkills();
			await this.mcpEngine.initialize();
		});

		void this.logger.log('PLUGIN_LOADED', { version: this.manifest.version });
		
		// Register Background Triggers
		this.triggerParser.registerTriggers();

		// Watch for Persona & Tool edits
		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				if (file.path.startsWith(`${this.settings.agenticVaultPath}/personas`)) {
					void this.personaEngine.loadPersonas();
				}
				if (file.path.startsWith(`${this.settings.agenticVaultPath}/tools`)) {
					void this.toolRegistry.loadTools();
				}
				if (file.path.startsWith(`${this.settings.agenticVaultPath}/skills`)) {
					void this.skillsEngine.loadSkills();
				}
			})
		);

		// Register Chat View
		this.registerView(
			VIEW_TYPE_CAREER_SHERPA_CHAT,
			(leaf) => new AgenticVaultChatView(leaf, this)
		);

		// Add settings tab
		this.addSettingTab(new AgenticVaultSettingTab(this.app, this));

		// Add Ribbon Icon
		this.addRibbonIcon('bot', 'Open Agentic Vault chat', () => {
			void this.openChatView();
		});

		// Add command to open the Chat View
		this.addCommand({
			id: 'open-agentic-vault-chat',
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			name: 'Open Agentic Vault chat',
			callback: () => {
				void this.openChatView();
			}
		});
	}

	async openChatView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CAREER_SHERPA_CHAT);
		if (leaves.length === 0) {
			const rightLeaf = this.app.workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({
					type: VIEW_TYPE_CAREER_SHERPA_CHAT,
					active: true,
				});
			}
		}
		const chatLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CAREER_SHERPA_CHAT)[0];
		if (chatLeaf) {
			// @ts-ignore
			void this.app.workspace.revealLeaf(chatLeaf);
		}
	}

	onunload() {
		console.debug("Agentic Vault AI unloading...");
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AgenticVaultSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
