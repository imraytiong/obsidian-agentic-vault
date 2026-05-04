import { Plugin } from 'obsidian';
import { AgenticVaultSettings, DEFAULT_SETTINGS, AgenticVaultSettingTab } from "./settings";
// Removed OnboardingModal
import { ChatService } from "./services/ChatService";
import { LoggerService } from "./services/LoggerService";
import { AgenticVaultChatView, VIEW_TYPE_CAREER_SHERPA_CHAT } from "./ui/ChatView";
import { TaskBoardView, VIEW_TYPE_AGENTIC_KANBAN } from "./ui/TaskBoardView";
import { PersonaEngine } from "./core/PersonaEngine";
import { SkillsEngine } from "./core/SkillsEngine";
import { TriggerParser } from "./core/TriggerParser";
import { ToolRegistry } from "./sandbox/ToolRegistry";
import { ExecutionSandbox } from "./sandbox/ExecutionSandbox";
import { McpEngine } from "./core/McpEngine";
import { RoutineManager } from "./core/RoutineManager";
import { ApprovalQueueManager } from "./core/ApprovalQueueManager";
import { TFile, Notice, WorkspaceLeaf } from 'obsidian';
import { FleetDashboardView, VIEW_TYPE_FLEET_DASHBOARD } from "./ui/FleetDashboardView";

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
	routineManager: RoutineManager;
	approvalQueue: ApprovalQueueManager;

	async onload() {
		console.debug("Agentic Vault AI is loading...");
		await this.loadSettings();
		const agenticVaultPath = this.settings.agenticVaultPath;

		// Initialize services
		this.logger = new LoggerService(this.app, agenticVaultPath);
		this.personaEngine = new PersonaEngine(this.app, agenticVaultPath);
		this.toolRegistry = new ToolRegistry(this.app, agenticVaultPath);
		this.executionSandbox = new ExecutionSandbox(this.app, this.logger, this.toolRegistry, this.settings.sandboxEngine, this.settings.customEnvPath);
		this.skillsEngine = new SkillsEngine(this.app, agenticVaultPath);
		this.mcpEngine = new McpEngine(this.app, agenticVaultPath, this.settings.customEnvPath);
		this.chatService = new ChatService(this);
		this.routineManager = new RoutineManager(this.app, this.logger, this.personaEngine, this.skillsEngine, this.chatService, agenticVaultPath);
		this.approvalQueue = new ApprovalQueueManager(this.app, agenticVaultPath);
		this.triggerParser = new TriggerParser(this.app, this.logger, this.executionSandbox, this.routineManager, this.chatService);

		// Register Views
		this.registerView(
			VIEW_TYPE_FLEET_DASHBOARD,
			(leaf) => new FleetDashboardView(leaf, this)
		);

		// Initialize dynamic content
		this.app.workspace.onLayoutReady(async () => {
			await this.personaEngine.loadPersonas();
			await this.toolRegistry.loadTools();
			await this.skillsEngine.loadSkills();
			await this.mcpEngine.initialize();
			await this.routineManager.initialize();
			await this.approvalQueue.loadQueue();
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
				if (file.path.startsWith(`${this.settings.agenticVaultPath}/routines`)) {
					void this.routineManager.loadRoutines();
					void this.routineManager.loadQueueState();
				}
			})
		);

		// Register Chat View
		this.registerView(
			VIEW_TYPE_CAREER_SHERPA_CHAT,
			(leaf) => new AgenticVaultChatView(leaf, this)
		);

		// Register Task Board View
		this.registerView(
			VIEW_TYPE_AGENTIC_KANBAN,
			(leaf) => new TaskBoardView(leaf, this)
		);

		// Add settings tab
		this.addSettingTab(new AgenticVaultSettingTab(this.app, this));

		// Add Ribbon Icon
		this.addRibbonIcon('bot', 'Open Agentic Vault chat', () => {
			void this.openChatView();
		});

		// Add Ribbon Icon for Kanban
		this.addRibbonIcon('layout-dashboard', 'Open Agentic Control Center', () => {
			void this.openTaskBoardView();
		});

		// Add Ribbon Icon for Dashboard
		this.addRibbonIcon('activity', 'Open Fleet Dashboard', () => {
			void this.activateDashboardView();
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
		// Add command to reload bundled fleets
		this.addCommand({
			id: 'reload-bundled-fleets',
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			name: 'Reload bundled fleets to vault',
			callback: async () => {
				const { BUNDLED_FLEETS } = await import('./blueprints/BundledFleets');
				const { BlueprintEngine } = await import('./blueprints/BlueprintEngine');
				const engine = new BlueprintEngine(this.app, this);
				const root = this.settings.rootFolder ? `${this.settings.rootFolder}/` : '';
				const agenticVaultPath = `${root}${this.settings.agenticVaultPath}`.replace(/\/+/g, '/').replace(/\/$/, '');
				
				const diffs: { path: string, type: 'modified' | 'missing' }[] = [];
				for (const fleet of BUNDLED_FLEETS) {
					const checkItems = async (items: any[], subDir: string) => {
						for (const item of items) {
							const fullPath = `${agenticVaultPath}/${subDir}/${item.filename}`.replace(/\/+/g, '/');
							const file = this.app.vault.getAbstractFileByPath(fullPath);
							if (!file) {
								diffs.push({ path: fullPath, type: 'missing' });
							} else if (file instanceof TFile && item.content) {
								const localContent = await this.app.vault.read(file);
								if (localContent !== item.content) {
									diffs.push({ path: fullPath, type: 'modified' });
								}
							}
						}
					};
					await checkItems(fleet.personas, 'personas');
					await checkItems(fleet.tools, 'tools');
					await checkItems(fleet.skills, 'skills');
				}

				const { ReloadDiffModal } = await import('./ui/ReloadDiffModal');
				new ReloadDiffModal(this.app, this, diffs, async (resolutions) => {
					
					// Pre-flight notice if AI merges are happening
					if (Object.values(resolutions).includes('merge')) {
						new Notice("Starting AI Merge... This may take a few seconds.");
					}

					const paths = [
						`${agenticVaultPath}/personas`,
						`${agenticVaultPath}/tools`,
						`${agenticVaultPath}/skills`,
						`${agenticVaultPath}/routines`
					];
					for (const p of paths) {
						const path = p.replace(/\/+/g, '/').replace(/\/$/, '');
						if (path && !this.app.vault.getAbstractFileByPath(path)) {
							await this.app.vault.createFolder(path);
						}
					}

					for (const fleet of BUNDLED_FLEETS) {
						await engine.installFleet(fleet, agenticVaultPath, resolutions);
					}
					
					await new Promise(resolve => window.setTimeout(resolve, 500));
					await this.personaEngine.loadPersonas();
					await this.toolRegistry.loadTools();
					await this.skillsEngine.loadSkills();
					await this.routineManager.initialize();
					
					new Notice(`Successfully synchronized bundled fleets into ${agenticVaultPath}`);
				}).open();
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

	async openTaskBoardView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENTIC_KANBAN);
		if (leaves.length === 0) {
			const leaf = this.app.workspace.getLeaf('tab');
			await leaf.setViewState({
				type: VIEW_TYPE_AGENTIC_KANBAN,
				active: true,
			});
		}
		const boardLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENTIC_KANBAN)[0];
		if (boardLeaf) {
			// @ts-ignore
			void this.app.workspace.revealLeaf(boardLeaf);
		}
	}

	async activateDashboardView() {
		const { workspace } = this.app;
		
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_FLEET_DASHBOARD);
		
		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE_FLEET_DASHBOARD, active: true });
			}
		}
		
		if (leaf) {
			workspace.revealLeaf(leaf);
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
