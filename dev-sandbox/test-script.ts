import { AgenticContext } from '../src/core/interfaces/Environment';
import { NodeFileSystem, NodeNetwork, NodeUI, NodeProcessRunner } from './src/adapters/NodeAdapter';
import { DEFAULT_SETTINGS } from '../src/settings';
import { LoggerService } from '../src/services/LoggerService';
import { PersonaEngine } from '../src/core/PersonaEngine';
import { ToolRegistry } from '../src/sandbox/ToolRegistry';
import { ExecutionSandbox } from '../src/sandbox/ExecutionSandbox';
import { RoutineManager } from '../src/core/RoutineManager';
import { ApprovalQueueManager } from '../src/core/ApprovalQueueManager';
import { McpEngine } from '../src/core/McpEngine';
import { ChatService } from '../src/services/ChatService';
import { TriggerParser } from '../src/core/TriggerParser';
import { App as ObsidianApp } from 'obsidian';
import { SkillsEngine } from '../src/core/SkillsEngine';
import path from 'path';
import fs from 'fs';

async function runTest() {
	console.log("Starting headless test...");
	const vaultPath = path.resolve(__dirname, '../test-vault-headless');
	
	const fleetsSource = path.resolve(__dirname, '../src/fleets');
	if (fs.existsSync(vaultPath)) fs.rmSync(vaultPath, { recursive: true, force: true });
	fs.mkdirSync(vaultPath, { recursive: true });
	fs.cpSync(fleetsSource, path.join(vaultPath, 'fleets'), { recursive: true });

	const settings = { 
		...DEFAULT_SETTINGS, 
		agenticVaultPath: 'fleets', 
		llmApiKey: 'AIzaSyA25LglHa1-zYILxaW3HVpYHifTBmn9Xls' 
	};

	const context: AgenticContext = {
		fs: new NodeFileSystem(vaultPath),
		network: new NodeNetwork(),
		ui: new NodeUI(),
		runner: new NodeProcessRunner(),
		settings,
		saveSettings: async () => {}
	};

	const mockApp = new ObsidianApp();
	const logger = new LoggerService(mockApp, settings.agenticVaultPath);
	const personaEngine = new PersonaEngine(mockApp, settings.agenticVaultPath);
	const toolRegistry = new ToolRegistry(mockApp, settings);
	const executionSandbox = new ExecutionSandbox(context, logger, toolRegistry, settings);
	const routineManager = new RoutineManager(mockApp, settings.agenticVaultPath);
	const approvalQueue = new ApprovalQueueManager(mockApp, settings.agenticVaultPath);
	const mcpEngine = new McpEngine(mockApp, settings.agenticVaultPath, settings.customEnvPath);
	const skillsEngine = new SkillsEngine(mockApp, settings.agenticVaultPath);

	const pluginMock: unknown = {
		settings,
		app: mockApp,
		logger,
		personaEngine,
		toolRegistry,
		executionSandbox,
		routineManager,
		approvalQueue,
		mcpEngine,
		skillsEngine,
		context,
		saveData: async () => {}
	};

	const chatService = new ChatService(pluginMock);
	pluginMock.chatService = chatService;
	new TriggerParser(mockApp, logger, executionSandbox, routineManager, chatService);

	context.logger = logger;
	context.personaEngine = personaEngine;
	context.toolRegistry = toolRegistry;
	context.executionSandbox = executionSandbox;
	context.routineManager = routineManager;
	context.approvalQueue = approvalQueue;
	context.mcpEngine = mcpEngine;
	context.chatService = chatService;
	context.skillsEngine = skillsEngine;

	await personaEngine.loadPersonas();
	await toolRegistry.loadTools();
	await routineManager.initialize();
	await skillsEngine.loadSkills();

	console.log("Environment initialized. Sending message...");
	await chatService.sendMessage('Install The Business of You (Executive Suite)', 'Concierge');

	const startTime = Date.now();
	while (chatService.isProcessing) {
		await new Promise(r => setTimeout(r, 1000));
		console.log("Still processing... elapsed:", Math.round((Date.now() - startTime)/1000), "seconds");
	}

	console.log("Processing finished!");
	
	const exists10 = await context.fs.exists('10_Strategy');
	console.log("10_Strategy exists:", exists10);
	
	const exists00 = await context.fs.exists('00_Inbox');
	console.log("00_Inbox exists:", exists00);

	console.log("\n--- UNIFIED TIMELINE ---");
	console.log(JSON.stringify(chatService.unifiedTimeline, null, 2));
}

runTest().catch(console.error);
