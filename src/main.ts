import { Plugin } from 'obsidian';
import { AgenticVaultSettings, DEFAULT_SETTINGS, AgenticVaultSettingTab } from "./settings";
// Removed OnboardingModal
import { ChatService } from "./services/ChatService";
import { LoggerService } from "./services/LoggerService";
import { AgenticVaultChatView, VIEW_TYPE_AGENTIC_CHAT } from "./ui/ChatView";
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
import { InitializationEngine } from "./core/InitializationEngine";

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
		try {
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
		this.routineManager = new RoutineManager(this.app, agenticVaultPath);
		this.approvalQueue = new ApprovalQueueManager(this.app, agenticVaultPath);
		this.triggerParser = new TriggerParser(this.app, this.logger, this.executionSandbox, this.routineManager, this.chatService);

		// Initialize Fleet Architecture (only if they have passed the onboarding gateway)
		if (this.settings.llmApiKey) {
			await this.initializeFleetArchitecture();
		}
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
			
			// Refresh any open views now that the managers are fully loaded
			this.app.workspace.getLeavesOfType(VIEW_TYPE_FLEET_DASHBOARD).forEach(leaf => {
				if ((leaf.view as any).onOpen) {
					(leaf.view as any).onOpen();
				}
			});
		});

		void this.logger.log('PLUGIN_LOADED', { version: this.manifest.version });
		
		// Register Background Triggers
		this.triggerParser.registerTriggers();

		// Watch for Persona & Tool edits
		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				if (!file.path.startsWith(`${this.settings.agenticVaultPath}/fleets`)) return;
				
				if (file.path.includes(`/personas/`)) {
					void this.personaEngine.loadPersonas();
				}
				if (file.path.includes(`/tools/`)) {
					void this.toolRegistry.loadTools();
				}
				if (file.path.includes(`/skills/`)) {
					void this.skillsEngine.loadSkills();
				}
				if (file.path.includes(`/routines/`)) {
					void this.routineManager.loadRoutines();
					void this.routineManager.loadTasks();
				}
			})
		);

		// Register Chat View
		this.registerView(
			VIEW_TYPE_AGENTIC_CHAT,
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
				await this.initializeFleetArchitecture();
				new Notice(`Successfully synchronized bundled fleets.`);
			}
		});

		} catch (e: any) {
			console.error("Agentic Vault failed to load:", e);
			new Notice("Agentic Vault failed to load: " + e.message, 10000);
		}
	}

	async initializeFleetArchitecture() {
		const initializationEngine = new InitializationEngine(this);
		await initializationEngine.initialize();
		
		await new Promise(resolve => window.setTimeout(resolve, 500));
		await this.personaEngine.loadPersonas();
		await this.toolRegistry.loadTools();
		await this.skillsEngine.loadSkills();
		await this.routineManager.initialize();
	}

	async openChatView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENTIC_CHAT);
		if (leaves.length === 0) {
			const rightLeaf = this.app.workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({
					type: VIEW_TYPE_AGENTIC_CHAT,
					active: true,
				});
			}
		}
		const chatLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENTIC_CHAT)[0];
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
		console.debug("Agentic Vault AI is unloading...");
		if (this.triggerParser) {
			this.triggerParser.unregisterTriggers();
		}
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_FLEET_DASHBOARD);
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_AGENTIC_CHAT);
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_AGENTIC_KANBAN);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AgenticVaultSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
