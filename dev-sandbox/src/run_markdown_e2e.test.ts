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
import { parseMarkdownTest } from './utils/MarkdownTestParser';

describe('Markdown E2E Test Runner', () => {
	const e2eDir = path.resolve(__dirname, '../../tests/e2e');
	const vaultPath = path.resolve(__dirname, '../../test-vault-markdown');

	if (!fs.existsSync(e2eDir)) {
		console.warn("No tests/e2e directory found. Skipping Markdown E2E tests.");
		return;
	}

	const testFiles = fs.readdirSync(e2eDir).filter(f => f.endsWith('.e2e.md'));

	for (const testFile of testFiles) {
		const scenario = parseMarkdownTest(path.join(e2eDir, testFile));

		describe(`Scenario: ${scenario.name}`, () => {
			let chatService: ChatService;
			let provider: MockLLMProvider;

			beforeAll(async () => {
				// Initialize fresh vault state
				const fleetsSource = path.resolve(__dirname, '../../src/fleets');
				if (fs.existsSync(vaultPath)) fs.rmSync(vaultPath, { recursive: true, force: true });
				fs.mkdirSync(path.join(vaultPath, 'AgenticVault'), { recursive: true });
				fs.cpSync(fleetsSource, path.join(vaultPath, 'AgenticVault', 'fleets'), { recursive: true });

				const settings = { ...DEFAULT_SETTINGS, agenticVaultPath: 'AgenticVault', llmApiKey: 'dummy-key' };

				const context: AgenticContext = {
					fs: new NodeFileSystem(vaultPath),
					network: new NodeNetwork(),
					ui: new NodeUI(),
					runner: new NodeProcessRunner(),
					settings,
					saveSettings: async () => {}
				};

				const mockApp = new ObsidianApp();
				
				// Same mockApp filesystem wiring as onboarding.test.ts
				mockApp.vault.getFiles = () => {
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

				mockApp.vault.create = async (p: string, c: string) => {
					await context.fs.writeText(p, c);
					const file = new TFile(); file.path = p; return file;
				};
				mockApp.vault.createFolder = async (p: string) => {
					fs.mkdirSync(path.join(vaultPath, p), { recursive: true });
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
					context, saveData: async () => {}
				};

				provider = new MockLLMProvider();
				chatService = new ChatService(pluginMock, provider);
				pluginMock.chatService = chatService;
				new TriggerParser(mockApp, logger, executionSandbox, routineManager, chatService);

				await personaEngine.loadPersonas();
				await toolRegistry.loadTools();
				await routineManager.initialize();
				await skillsEngine.loadSkills();

				if (scenario.assume_installed_fleet) {
					const { InitializationEngine } = await import('../../src/core/InitializationEngine');
					const engine = new InitializationEngine(pluginMock);
					await engine.deployFleet(scenario.assume_installed_fleet);
					
					// Automatically map the required zones and create the directories
					const { BundledFleets } = await import('../../src/blueprints/BundledFleets');
					const fleetData = BundledFleets[scenario.assume_installed_fleet];
					if (fleetData && fleetData.required_zones) {
						if (!pluginMock.settings.semanticZones) pluginMock.settings.semanticZones = {};
						for (const z of fleetData.required_zones) {
							pluginMock.settings.semanticZones[z.zone_id] = {
								path: z.vault_path,
								description: z.description
							};
							const fullZonePath = path.join(vaultPath, z.vault_path);
							if (!fs.existsSync(fullZonePath)) {
								fs.mkdirSync(fullZonePath, { recursive: true });
							}
						}
					}

					// Re-load tools and personas after deployment
					await personaEngine.loadPersonas();
					await toolRegistry.loadTools();
				}
			});

			it('should execute the scenario successfully', async () => {
				// Queue expected tool calls
				if (scenario.expectedToolCalls.length > 0) {
					provider.queueResponse({
						toolCalls: scenario.expectedToolCalls.map((tc, idx) => ({
							id: `call_${idx}`,
							name: tc.name,
							arguments: tc.arguments
						}))
					});
				}

				// Queue expected output
				provider.queueResponse({
					content: scenario.expectedOutput
				});

				// Trigger chat
				const res = await chatService.sendMessage(scenario.userInput, scenario.persona);
				console.log("SEND_MESSAGE_RESULT:", res);

				// Assert directories
				for (const expectedDir of scenario.expectedDirectories) {
					const exists = fs.existsSync(path.join(vaultPath, expectedDir));
					if (!exists) {
						console.error(`Missing directory: ${expectedDir}`);
						console.error(JSON.stringify(chatService.unifiedTimeline, null, 2));
					}
					expect(exists).toBe(true);
				}

				// Assert files
				for (const expectedFile of scenario.expectedFiles) {
					const exists = fs.existsSync(path.join(vaultPath, expectedFile));
					expect(exists).toBe(true);
				}

				// Assert final message
				const timeline = chatService.unifiedTimeline;
				const lastMessage = timeline[timeline.length - 1];
				expect(lastMessage.content).toContain(scenario.expectedOutput);
			}, 30000);
		});
	}
});
