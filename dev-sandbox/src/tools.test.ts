import { describe, it, expect, beforeAll } from 'vitest';
import { AgenticContext } from '../../src/core/interfaces/Environment';
import { NodeFileSystem, NodeNetwork, NodeUI, NodeProcessRunner } from './adapters/NodeAdapter';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { LoggerService } from '../../src/services/LoggerService';
import { ExecutionSandbox } from '../../src/sandbox/ExecutionSandbox';
import { ToolRegistry } from '../../src/sandbox/ToolRegistry';
import { App as ObsidianApp, TFolder, TFile } from 'obsidian';
import path from 'path';
import fs from 'fs';

describe('Phase 4: Isolated Tool Efficacy Tests', () => {
	let sandbox: ExecutionSandbox;
	let context: AgenticContext;
	let mockApp: unknown;
	const vaultPath = path.resolve(__dirname, '../../test-vault-tools');

	beforeAll(async () => {
		if (fs.existsSync(vaultPath)) fs.rmSync(vaultPath, { recursive: true, force: true });
		fs.mkdirSync(vaultPath, { recursive: true });
		
		const fleetsSource = path.resolve(__dirname, '../../src/fleets');
		fs.mkdirSync(path.join(vaultPath, 'AgenticVault'), { recursive: true });
		fs.cpSync(fleetsSource, path.join(vaultPath, 'AgenticVault', 'fleets'), { recursive: true });

		const settings = { 
			...DEFAULT_SETTINGS, 
			agenticVaultPath: 'AgenticVault',
			zones: {
				strategy: '10_Strategy',
				execution: '20_Execution',
				journal: '60_Journal'
			}
		};

		context = {
			fs: new NodeFileSystem(vaultPath),
			network: new NodeNetwork(),
			ui: new NodeUI(),
			runner: new NodeProcessRunner(vaultPath),
			settings,
			saveSettings: async () => {}
		};

		mockApp = new ObsidianApp();
		
		mockApp.vault.read = async (file: unknown) => {
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
			const fullPath = path.join(vaultPath, p);
			fs.mkdirSync(path.dirname(fullPath), { recursive: true });
			await context.fs.writeText(p, c);
			const file = new TFile(); file.path = p; return file;
		};
		mockApp.vault.append = async (file: unknown, text: string) => {
			const current = await context.fs.readText(file.path);
			await context.fs.writeText(file.path, current + text);
		};
		mockApp.vault.createFolder = async (p: string) => {
			fs.mkdirSync(path.join(vaultPath, p), { recursive: true });
		};

		const logger = new LoggerService(mockApp, settings.agenticVaultPath);
		const toolRegistry = new ToolRegistry(mockApp, settings);
		await toolRegistry.loadTools();
		
		sandbox = new ExecutionSandbox(context, logger, toolRegistry, settings);

		// Pre-create Me.md for update_profile
		await mockApp.vault.create('AgenticVault/Me.md', '---\nname: User\n---\nInitial content.');
	});

	it('should execute echo tool correctly', async () => {
		const result = await sandbox.executeTool('echo', { message: 'Hello World' }, 'core');
		const parsed = JSON.parse(result.output);
		expect(parsed.status).toBe('success');
	});

	it('should execute file_manager CRUD operations correctly', async () => {
		// 1. Write file
		const writeResult = await sandbox.executeTool('file_manager', {
			action: 'write_file',
			zone_id: 'journal',
			relative_filename: 'test.md',
			content: 'Hello File'
		}, 'core', { journal: 'full_read_write' });
		const parsedWrite = JSON.parse(writeResult.output);
		expect(parsedWrite.status).toBe('success');
		expect(fs.existsSync(path.join(vaultPath, '60_Journal', 'test.md'))).toBe(true);

		// 2. Read file
		const readResult = await sandbox.executeTool('file_manager', {
			action: 'read_file',
			zone_id: 'journal',
			relative_filename: 'test.md'
		}, 'core', { journal: 'full_read_write' });
		const parsedRead = JSON.parse(readResult.output);
		expect(parsedRead.content).toBe('Hello File');
	});

	it('should execute manage_queue tool correctly', async () => {
		// manage_queue is currently a stub in business_of_you, so we just check it returns success.
		const pushResult1 = await sandbox.executeTool('manage_queue', {
			action: 'push',
			zone_id: 'execution',
			queue_name: 'tasks.jsonl',
			item: { title: 'Task 1', priority: 'high' }
		}, 'business_of_you', { execution: 'full_read_write' });
		const parsedPush1 = JSON.parse(pushResult1.output);
		expect(parsedPush1.status).toBe('success');
	});

	it('should execute update_profile correctly', async () => {
		// Create the initial file since update_profile expects it to write correctly or create if missing depending on strategy zone. 
		// The tool checks process.cwd() + strategyZone + 'Me.md'
		fs.mkdirSync(path.join(vaultPath, '10_Strategy'), { recursive: true });

		const updateResult = await sandbox.executeTool('update_profile', {
			action: 'overwrite',
			content: 'This is my identity.'
		}, 'core', { strategy: 'full_read_write' });
		
		const meFile = fs.readFileSync(path.join(vaultPath, '10_Strategy', 'Me.md'), 'utf8');
		expect(meFile).toContain('This is my identity.');
	});

	it('should execute read_calendar stub tool correctly', async () => {
		const result = await sandbox.executeTool('read_calendar', { date: 'today' }, 'business_of_you');
		const parsed = JSON.parse(result.output);
		expect(parsed.status).toBe('success');
		expect(parsed.message).toContain('read_calendar stub executed');
	});

	it('should execute crm_query stub tool correctly', async () => {
		const result = await sandbox.executeTool('crm_query', { query: 'Sarah' }, 'business_of_you');
		const parsed = JSON.parse(result.output);
		expect(parsed.status).toBe('success');
		expect(parsed.message).toContain('crm_query stub executed');
	});
});
