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
import { GeminiProvider } from '../../src/llm/GeminiProvider';
import { SkillsEngine } from '../../src/core/SkillsEngine';
import fs from 'fs';
import path from 'path';

describe('AntiGravity Headless Engine: Onboarding Flow', () => {
	let chatService: ChatService;
	let context: AgenticContext;
	let mockApp: any;
	let provider: GeminiProvider;
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
							const cFolder = new TFolder(); cFolder.path = childPath; cFolder.name = f; folder.children.push(cFolder);
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

		const logger = new LoggerService(mockApp, settings.agenticVaultPath);
		const personaEngine = new PersonaEngine(mockApp, settings.agenticVaultPath);
		const toolRegistry = new ToolRegistry(mockApp, settings);
		const executionSandbox = new ExecutionSandbox(context, logger, toolRegistry, settings);
		const routineManager = new RoutineManager(mockApp, settings.agenticVaultPath);
		const approvalQueue = new ApprovalQueueManager(mockApp, settings.agenticVaultPath);
		const mcpEngine = new McpEngine(mockApp, settings.agenticVaultPath, settings.customEnvPath);
		const skillsEngine = new SkillsEngine(mockApp, settings.agenticVaultPath);

		const pluginMock: any = {
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

		provider = new GeminiProvider(settings.llmApiKey, 'gemini-2.5-flash', context.network!);
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
		// 1. Trigger the user message to install the fleet
		await chatService.sendMessage('Install The Business of You (Executive Suite)', 'Concierge');

		// Wait for the processing to complete
		const startTime = Date.now();
		let completed = false;
		while (Date.now() - startTime < 110000) {
			if (!chatService.isProcessing) {
				// Wait 2 seconds just in case it's between tool calls
				await new Promise(resolve => setTimeout(resolve, 2000));
				if (!chatService.isProcessing) {
					completed = true;
					break;
				}
			}
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
		
		if (!completed) {
			console.log("TEST TIMED OUT. LAST TIMELINE MESSAGES:", JSON.stringify(chatService.unifiedTimeline.slice(-3), null, 2));
		}

		expect(completed).toBe(true);
		
		const latestMessage = chatService.unifiedTimeline[chatService.unifiedTimeline.length - 1]?.content || '';
		
		// Use LLM-as-a-judge
		const judgePrompt = `You are an impartial judge evaluating the output of an AI agent.
The user asked: "Install The Business of You (Executive Suite)".
The agent responded with:
"""
${latestMessage}
"""

Did the agent successfully fulfill the request and indicate that the fleet was installed and zones were allocated? Or did it encounter an error?
Return ONLY a JSON object: { "success": true } or { "success": false }`;

		const judgeResponse = await provider.generateResponse([{ role: 'user', content: judgePrompt }]);
		let isSuccess = false;
		try {
			const jsonMatch = judgeResponse.content?.match(/{[\s\S]*}/);
			if (jsonMatch) {
				const res = JSON.parse(jsonMatch[0]);
				isSuccess = res.success === true;
			}
		} catch (e) {}

		if (!isSuccess) {
			console.error("LLM Judge failed the response:", latestMessage);
		}
		expect(isSuccess).toBe(true);

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

		// Assert the Concierge timeline includes a message
		const lastMsg = chatService.unifiedTimeline[chatService.unifiedTimeline.length - 1];
		expect(lastMsg.role).toBe('assistant');
		expect(lastMsg.persona).toBe('Concierge');
		
	}, 120000); // 120 second timeout since LLM takes time
});
