import { App, TFile, TFolder } from 'obsidian';

export interface RoutineDefinition {
	id: string;
	name: string;
	trigger: string;
	agent: string;
	skill: string;
	status: string;
	content: string;
}

export interface RoutineState {
	id: string;
	status: 'idle' | 'running' | 'completed' | 'failed';
	lastRunTime?: number;
	nextRunTime?: number;
	lastError?: string;
}

export class RoutineManager {
	private app: App;
	private vaultPath: string;
	private queueFilePath: string;

	private routines: Record<string, RoutineDefinition> = {};
	private queueState: Record<string, RoutineState> = {};

	public onStateChanged?: () => void;

	constructor(app: App, vaultPath: string) {
		this.app = app;
		this.vaultPath = vaultPath;
		this.queueFilePath = `${this.vaultPath}/logs/routine_queue.json`.replace(/\/+/g, '/');
	}

	async initialize() {
		// Ensure logs directory exists
		const logsDir = `${this.vaultPath}/logs`.replace(/\/+/g, '/');
		if (logsDir && !this.app.vault.getAbstractFileByPath(logsDir)) {
			try {
				await this.app.vault.createFolder(logsDir);
			} catch (e) {
				// Directory might have just been created
			}
		}

		await this.loadRoutines();
		await this.loadQueueState();
	}

	async loadRoutines() {
		const routinesPath = `${this.vaultPath}/routines`.replace(/\/+/g, '/');
		const folder = this.app.vault.getAbstractFileByPath(routinesPath);
		
		this.routines = {};
		
		if (folder instanceof TFolder) {
			for (const child of folder.children) {
				if (child instanceof TFile && child.extension === 'md') {
					const content = await this.app.vault.read(child);
					const id = child.basename;
					
					// Basic frontmatter parsing
					let name = id, trigger = '', agent = '', skill = '', status = 'active';
					
					if (content.startsWith('---')) {
						const endIdx = content.indexOf('---', 3);
						if (endIdx !== -1) {
							const fm = content.substring(3, endIdx);
							const lines = fm.split('\n');
							for (const line of lines) {
								if (line.startsWith('name:')) name = line.substring(5).trim();
								if (line.startsWith('trigger:')) trigger = line.substring(8).trim().replace(/^["']|["']$/g, '');
								if (line.startsWith('agent:')) agent = line.substring(6).trim();
								if (line.startsWith('skill:')) skill = line.substring(6).trim();
								if (line.startsWith('status:')) status = line.substring(7).trim();
							}
						}
					}

					this.routines[id] = { id, name, trigger, agent, skill, status, content };
				}
			}
		}
	}

	async loadQueueState() {
		const file = this.app.vault.getAbstractFileByPath(this.queueFilePath);
		if (file instanceof TFile) {
			try {
				const content = await this.app.vault.read(file);
				this.queueState = JSON.parse(content);
			} catch (e) {
				this.queueState = {};
			}
		} else {
			this.queueState = {};
			await this.saveQueueState();
		}

		// Reconcile with current routines
		let stateChanged = false;
		for (const id of Object.keys(this.routines)) {
			if (!this.queueState[id]) {
				this.queueState[id] = { id, status: 'idle' };
				stateChanged = true;
			}
		}
		
		if (stateChanged) {
			await this.saveQueueState();
		}
	}

	async saveQueueState() {
		const file = this.app.vault.getAbstractFileByPath(this.queueFilePath);
		const jsonString = JSON.stringify(this.queueState, null, 2);
		
		if (file instanceof TFile) {
			await this.app.vault.modify(file, jsonString);
		} else {
			await this.app.vault.create(this.queueFilePath, jsonString);
		}

		if (this.onStateChanged) {
			this.onStateChanged();
		}
	}

	getRoutines(): RoutineDefinition[] {
		return Object.values(this.routines);
	}

	getQueueState(): Record<string, RoutineState> {
		return this.queueState;
	}

	async updateRoutineState(id: string, updates: Partial<RoutineState>) {
		if (!this.queueState[id]) {
			this.queueState[id] = { id, status: 'idle' };
		}
		
		this.queueState[id] = { ...this.queueState[id], ...updates };
		await this.saveQueueState();
	}
}
