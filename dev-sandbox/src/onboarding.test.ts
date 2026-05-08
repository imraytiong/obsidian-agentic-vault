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
import { App as ObsidianApp, TFolder, TFile } from 'obsidian';
import { MockLLMProvider } from './mocks/MockLLMProvider';
import { SkillsEngine } from '../../src/core/SkillsEngine';
import fs from 'fs';
import path from 'path';

describe('AntiGravity Headless Engine: Onboarding Flow', () => {
	let chatService: ChatService;
	let context: AgenticContext;
	let mockApp: any;
	let provider: MockLLMProvider;
	const vaultPath = path.resolve(__dirname, '../../test-vault-headless');

	beforeAll(async () => {
		// Target a fresh isolated vault directory for tests to prevent contaminating test-vault-empty
		
		// Ensure fleets folder exists in the headless test vault
		const fleetsSource = path.resolve(__dirname, '../../src/fleets');
		const fs = (await import('fs')).default;
		if (fs.existsSync(vaultPath)) fs.rmSync(vaultPath, { recursive: true, force: true });
		fs.mkdirSync(path.join(vaultPath, 'AgenticVault'), { recursive: true });
		fs.cpSync(fleetsSource, path.join(vaultPath, 'AgenticVault', 'fleets'), { recursive: true });

		const settings = { 
			...DEFAULT_SETTINGS, 
			agenticVaultPath: 'AgenticVault', 
			llmApiKey: 'AIzaSyA25LglHa1-zYILxaW3HVpYHifTBmn9Xls' 
		};

		context = {
			fs: new NodeFileSystem(vaultPath),
			network: new NodeNetwork(),
			ui: new NodeUI(),
			runner: new NodeProcessRunner(),
			settings,
			saveSettings: async () => {}
		};

		mockApp = new ObsidianApp();
		
		// Wire up mockApp to our NodeFileSystem
		const getAllFiles = async (dir: string): Promise<any[]> => {
			let results: any[] = [];
			const list = await context.fs.listFiles(dir);
			for (const p of list) {
				const fullPath = context.fs.resolvePath ? (context.fs as any).resolvePath(p) : path.join(vaultPath, p);
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
			// We need a sync-like interface for getFiles, but since we are running in Node,
			// we can just read the whole tree synchronously for testing purposes.
			const readDirRecursiveSync = (dir: string, base: string = ''): any[] => {
				let results: any[] = [];
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

		mockApp.vault.read = async (file: any) => {
			return await context.fs.readText(file.path);
		};
		
		mockApp.vault.getAbstractFileByPath = (p: string) => {
			const fullPath = path.join(vaultPath, p);
			if (fs.existsSync(fullPath)) {
				const stat = fs.statSync(fullPath);
				if (stat.isDirectory()) {
					const folder = new TFolder();
					folder.path = p;
					folder.name = path.basename(p);
					folder.children = [];
					const list = fs.readdirSync(fullPath);
					for (const f of list) {
						const childPath = path.join(p, f);
						if (fs.statSync(path.join(fullPath, f)).isDirectory()) {
							const cFolder = new TFolder(); cFolder.path = childPath; cFolder.name = f; cFolder.children = []; folder.children.push(cFolder);
						} else {
							const cFile = new TFile(); 
							cFile.path = childPath; 
							cFile.name = f; 
							cFile.extension = path.extname(f).substring(1);
							cFile.basename = path.basename(f, path.extname(f));
							folder.children.push(cFile);
						}
					}
					return folder;
				} else {
					const file = new TFile();
					file.path = p;
					file.name = path.basename(p);
					file.extension = path.extname(p).substring(1);
					file.basename = path.basename(p, path.extname(p));
					return file;
				}
			}
			return null;
		};

		mockApp.vault.create = async (p: string, c: string) => {
			fs.mkdirSync(path.dirname(path.join(vaultPath, p)), { recursive: true });
			await context.fs.writeText(p, c);
			const file = new TFile(); file.path = p; return file;
		};
		mockApp.vault.append = async (file: any, text: string) => {
			const current = await context.fs.readText(file.path);
			await context.fs.writeText(file.path, current + text);
		};
		mockApp.vault.createFolder = async (p: string) => {
			fs.mkdirSync(path.join(vaultPath, p), { recursive: true });
		};
		mockApp.vault.copy = async (file: any, destPath: string) => {
			const destFull = path.join(vaultPath, destPath);
			const srcFull = path.join(vaultPath, file.path);
			fs.mkdirSync(path.dirname(destFull), { recursive: true });
			fs.cpSync(srcFull, destFull);
			return mockApp.vault.getAbstractFileByPath(destPath);
		};

		const logger = new LoggerService(mockApp, settings.agenticVaultPath);
		const personaEngine = new PersonaEngine(mockApp, settings.agenticVaultPath);
		const toolRegistry = new ToolRegistry(mockApp, settings);
		const executionSandbox = new ExecutionSandbox(context, logger, toolRegistry, settings);
		const routineManager = new RoutineManager(mockApp, settings.agenticVaultPath);
		const approvalQueue = new ApprovalQueueManager(mockApp, settings.agenticVaultPath);
		const mcpEngine = new McpEngine(mockApp, settings.agenticVaultPath, settings.customEnvPath);
		const skillsEngine = new SkillsEngine(mockApp, settings.agenticVaultPath);

		const pluginMock: any = {
			settings, app: mockApp, logger, personaEngine, toolRegistry,
			executionSandbox, routineManager, approvalQueue, mcpEngine, skillsEngine,
			context, saveData: async () => {}, saveSettings: async () => {}
		};

		provider = new MockLLMProvider();
		chatService = new ChatService(pluginMock as any, provider);
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
		
		console.log("LOADED TOOLS:", toolRegistry.getAllTools().map(t => t.name));
	});

	it('should successfully run the business of you onboarding flow', async () => {
		// Queue Response 1: Call install_fleet
		provider.queueResponse({
			content: "Triggering installation.",
			toolCalls: [{
				id: "call_1",
				name: "install_fleet",
				arguments: { fleet_name: "business_of_you" }
			}]
		});

		// Queue Response 2: Call allocate_zone multiple times based on the parsed zones
		provider.queueResponse({
			content: "Allocating the required zones.",
			toolCalls: [
				{
					id: "call_2",
					name: "allocate_zone",
					arguments: { zone_id: "strategy", vault_path: "10_Strategy", description: "Business strategy documents" }
				},
				{
					id: "call_3",
					name: "allocate_zone",
					arguments: { zone_id: "execution", vault_path: "20_Execution", description: "Business operations" }
				}
			]
		});

		// Queue Response 3: Final completion message
		provider.queueResponse({
			content: "The Business of You fleet has been successfully installed and zones allocated. How else can I help?"
		});

		// 1. Trigger the user message to install the fleet
		await chatService.sendMessage('Install The Business of You (Executive Suite)', 'Concierge');

		// 2. Assert that the underlying folder structure was actually created
		const businessFleetFolder = fs.existsSync(path.join(vaultPath, 'AgenticVault', 'fleets', 'business_of_you'));
		expect(businessFleetFolder).toBe(true);

		// 3. Check for specific tools that should have been unpacked
		const crmToolExists = fs.existsSync(path.join(vaultPath, 'AgenticVault', 'fleets', 'business_of_you', 'tools', 'crm_query.md'));
		expect(crmToolExists).toBe(true);
		
		console.log(JSON.stringify(chatService.unifiedTimeline, null, 2));

		// 4. Validate zone allocation
		const strategyZone = fs.existsSync(path.join(vaultPath, '10_Strategy'));
		const opsZone = fs.existsSync(path.join(vaultPath, '20_Execution'));
		const templatesDir = fs.existsSync(path.join(vaultPath, 'AgenticVault', 'fleets', 'business_of_you', 'templates'));
		
		expect(strategyZone).toBe(true);
		expect(opsZone).toBe(true);
		expect(templatesDir).toBe(true);

		// console.log(JSON.stringify(chatService.unifiedTimeline, null, 2));

		// 3. Assert the Concierge timeline includes the success message
		const latestMessage = chatService.unifiedTimeline[chatService.unifiedTimeline.length - 1];
		expect(latestMessage.role).toBe('assistant');
		expect(latestMessage.persona).toBe('Concierge');
		
	}, 120000); // 120 second timeout since LLM takes time
});
