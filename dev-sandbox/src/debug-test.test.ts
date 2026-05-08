import { describe, it, expect, beforeAll } from 'vitest';
import { AgenticContext } from '../../src/core/interfaces/Environment';
import { NodeFileSystem, NodeNetwork, NodeUI, NodeProcessRunner } from './adapters/NodeAdapter';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { LoggerService } from '../../src/services/LoggerService';
import { PersonaEngine } from '../../src/core/PersonaEngine';
import { ToolRegistry } from '../../src/sandbox/ToolRegistry';
import { ExecutionSandbox } from '../../src/sandbox/ExecutionSandbox';
import { RoutineManager } from '../../src/core/RoutineManager';
import { ApprovalQueueManager } from '../../src/core/ApprovalQueueManager';
import { McpEngine } from '../../src/core/McpEngine';
import { ChatService } from '../../src/services/ChatService';
import { TriggerParser } from '../../src/core/TriggerParser';
import { App as ObsidianApp } from 'obsidian';
import { SkillsEngine } from '../../src/core/SkillsEngine';
import path from 'path';
import fs from 'fs';

async function runTest() {
	console.log("Starting headless test...");
	const vaultPath = path.resolve(__dirname, '../../test-vault-headless');
	
	const fleetsSource = path.resolve(__dirname, '../../src/fleets');
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
	
	const getAllFiles = async (dir: string): Promise<unknown[]> => {
		let results: unknown[] = [];
		const list = await context.fs.listFiles(dir);
		for (const p of list) {
			const fullPath = context.fs.resolvePath ? (context.fs as unknown).resolvePath(p) : path.join(vaultPath, p);
			if (fs.statSync(fullPath).isDirectory()) {
				results = results.concat(await getAllFiles(p));
			} else {
				results.push({
					path: p,
					name: path.basename(p),
					extension: path.extname(p).substring(1)
				});
			}
		}
		return results;
	};

	mockApp.vault.getFiles = () => {
		const readDirRecursiveSync = (dir: string, base: string = ''): unknown[] => {
			let results: unknown[] = [];
			const list = fs.readdirSync(dir);
			for (const f of list) {
				const fullPath = path.join(dir, f);
				const relPath = path.join(base, f);
				if (fs.statSync(fullPath).isDirectory()) {
					results = results.concat(readDirRecursiveSync(fullPath, relPath));
				} else {
					results.push({
						path: relPath,
						name: f,
						extension: path.extname(f).substring(1),
						basename: path.basename(f, path.extname(f))
					});
				}
			}
			return results;
		};
		return readDirRecursiveSync(vaultPath);
	};

	mockApp.vault.read = async (file: unknown) => {
		return await context.fs.readText(file.path);
	};
	
	mockApp.vault.getAbstractFileByPath = (p: string) => {
		const files = mockApp.vault.getFiles();
		return files.find((f: unknown) => f.path === p) || null;
	};

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

	console.log(`Registered Tools: ${toolRegistry.getAllTools().map(t => t.name).join(', ')}`);

	console.log("Environment initialized. Sending message...");
	await chatService.sendMessage('Please use the install_fleet tool to install the business_of_you fleet.', 'Concierge');

	const startTime = Date.now();
	while (chatService.isProcessing && Date.now() - startTime < 110000) {
		await new Promise(r => setTimeout(r, 1000));
		console.log("Still processing... elapsed:", Math.round((Date.now() - startTime)/1000), "seconds");
	}

	console.log("Processing finished!");

	console.log("\n--- UNIFIED TIMELINE ---");
	console.log(JSON.stringify(chatService.unifiedTimeline, null, 2));
}

runTest().catch(console.error);
