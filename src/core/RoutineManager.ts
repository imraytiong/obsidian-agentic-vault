import { App, TFile, TFolder, parseYaml } from 'obsidian';

export interface RoutineDefinition {
	id: string;
	name: string;
	trigger: string;
	agent: string;
	skill: string;
	status: string;
	timeout: number;
	retries: number;
	content: string;
	fleet: string;
	path: string;
	last_run: number;
}

export interface RoutineTask {
	id: string;
	routineId: string;
	routineName: string;
	status: 'pending' | 'running' | 'completed' | 'failed';
	spawnTime: number;
	endTime?: number;
	error?: string;
	attempts: number;
}

export class RoutineManager {
	private app: App;
	private vaultPath: string;
	private queueFilePath: string;

	private routines: Record<string, RoutineDefinition> = {};
	private tasks: RoutineTask[] = [];

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
		await this.loadTasks();
	}

	async loadRoutines() {
		this.routines = {};
		
		const fleetsPath = `${this.vaultPath}/fleets`.replace(/\/+/g, '/');
		const fleetsFolder = this.app.vault.getAbstractFileByPath(fleetsPath);
		if (!fleetsFolder || !(fleetsFolder instanceof TFolder)) return;

		for (const fleetDir of fleetsFolder.children) {
			if (!(fleetDir instanceof TFolder)) continue;
			
			const fleetName = fleetDir.name;
			
			const fleetMd = this.app.vault.getAbstractFileByPath(`${fleetDir.path}/fleet.md`);
			if (fleetMd && fleetMd instanceof TFile) {
				const cache = this.app.metadataCache.getFileCache(fleetMd);
				if (cache?.frontmatter?.status === 'disabled') continue;
			}

			const routinesPath = `${fleetDir.path}/routines`;
			const folder = this.app.vault.getAbstractFileByPath(routinesPath);
			if (!folder || !(folder instanceof TFolder)) continue;

			for (const child of folder.children) {
				if (child instanceof TFile && child.extension === 'md') {
					const content = await this.app.vault.read(child);
					const id = child.basename;
					// Parse frontmatter
					let frontmatter: unknown = {};
					const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
					if (fmMatch) {
						try {
							frontmatter = parseYaml(fmMatch[1] || '') || {};
						} catch (e) {
							console.error(`Failed to parse YAML for routine ${child.path}`, e);
						}
					}

					let name = (frontmatter as Record<string, any>).name || id;
					let trigger = (frontmatter as Record<string, any>).trigger || '';
					let agent = (frontmatter as Record<string, any>).agent || '';
					let skill = (frontmatter as Record<string, any>).skill || '';
					let status = (frontmatter as Record<string, any>).status || 'active';
					let timeout = (frontmatter as Record<string, any>).timeout !== undefined ? parseInt((frontmatter as Record<string, any>).timeout) : 5;
					let retries = (frontmatter as Record<string, any>).retries !== undefined ? parseInt((frontmatter as Record<string, any>).retries) : 3;
					let last_run = (frontmatter as Record<string, any>).last_run !== undefined ? parseInt((frontmatter as Record<string, any>).last_run) : 0;
					
					// Default to 3 retries if not specified
					if (retries === undefined || isNaN(retries)) retries = 3;

					this.routines[`${fleetName}.${id}`] = { 
						id: `${fleetName}.${id}`, 
						name, 
						trigger, 
						agent, 
						skill, 
						status, 
						timeout, 
						retries, 
						last_run,
						content,
						fleet: fleetName,
						path: child.path 
					};
				}
			}
		}
		
		if (this.onStateChanged) {
			this.onStateChanged();
		}
	}

	async loadTasks() {
		const file = this.app.vault.getAbstractFileByPath(this.queueFilePath);
		if (file instanceof TFile) {
			try {
				const content = await this.app.vault.read(file);
				const data = JSON.parse(content);
				if (Array.isArray(data)) {
					this.tasks = data;
				} else {
					// Migration from old format
					this.tasks = [];
					await this.saveTasks();
				}
			} catch (e) {
				this.tasks = [];
			}
		} else {
			this.tasks = [];
			await this.saveTasks();
		}
	}

	async toggleRoutineStatus(routineId: string) {
		const routine = this.routines[routineId];
		if (!routine) return;

		const file = this.app.vault.getAbstractFileByPath(routine.path);
		
		if (file instanceof TFile) {
			const newStatus = routine.status === 'active' ? 'inactive' : 'active';
			let content = await this.app.vault.read(file);
			
			// Replace status in frontmatter
			if (content.match(/^status:\s*(active|inactive)/m)) {
				content = content.replace(/^status:\s*(active|inactive)/m, `status: ${newStatus}`);
			} else if (content.startsWith('---')) {
				// Status field doesn't exist, insert it
				content = content.replace('---', `---\nstatus: ${newStatus}`);
			}
			
			await this.app.vault.modify(file, content);
			
			// Update memory instantly for UI responsiveness
			routine.status = newStatus;
			
			if (this.onStateChanged) {
				this.onStateChanged();
			}
		}
	}

	async updateRoutineField(routineId: string, field: 'trigger' | 'agent' | 'skill' | 'timeout' | 'retries' | 'last_run', value: string | number) {
		const routine = this.routines[routineId];
		if (!routine) return;

		const routinesPath = `${this.vaultPath}/routines`.replace(/\/+/g, '/');
		const file = this.app.vault.getAbstractFileByPath(`${routinesPath}/${routineId}.md`);
		
		if (file instanceof TFile) {
			let content = await this.app.vault.read(file);
			
			const regex = new RegExp(`^${field}:.*$`, 'm');
			if (content.match(regex)) {
				content = content.replace(regex, `${field}: ${value}`);
			} else if (content.startsWith('---')) {
				content = content.replace('---', `---\n${field}: ${value}`);
			}
			
			await this.app.vault.modify(file, content);
			if (this.routines[routineId]) {
				(this.routines[routineId] as unknown as Record<string, string | number>)[field] = value;
			}
			
			if (this.onStateChanged) {
				this.onStateChanged();
			}
		}
	}

	async saveTasks() {
		if (this.tasks.length > 100) {
			this.tasks = this.tasks.slice(-100);
		}

		const file = this.app.vault.getAbstractFileByPath(this.queueFilePath);
		const jsonString = JSON.stringify(this.tasks, null, 2);
		
		if (file instanceof TFile) {
			await this.app.vault.modify(file, jsonString);
		} else {
			try {
				await this.app.vault.create(this.queueFilePath, jsonString);
			} catch (e: unknown) {
				const errMsg = import('../utils/ErrorUtils').then(m => m.getErrorMessage(e));
				if (String(e).includes('already exists')) {
					await this.app.vault.adapter.write(this.queueFilePath, jsonString);
				} else {
					console.error("RoutineManager failed to save tasks", e);
				}
			}
		}

		if (this.onStateChanged) {
			this.onStateChanged();
		}
	}

	getRoutines(): RoutineDefinition[] {
		return Object.values(this.routines);
	}

	getTasks(): RoutineTask[] {
		return this.tasks;
	}

	async abortTask(taskId: string) {
		const task = this.tasks.find(t => t.id === taskId);
		if (task && task.status === 'running') {
			task.status = 'failed';
			task.error = 'Manually aborted from dashboard';
			task.endTime = Date.now();
			await this.saveTasks();
		}
	}

	spawnTask(routine: RoutineDefinition): RoutineTask {
		const task: RoutineTask = {
			id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
			routineId: routine.id,
			routineName: routine.name,
			status: 'pending',
			spawnTime: Date.now(),
			attempts: 0
		};
		this.tasks.push(task);
		void this.saveTasks();
		return task;
	}

	async updateTask(taskId: string, updates: Partial<RoutineTask>) {
		const task = this.tasks.find(t => t.id === taskId);
		if (task) {
			Object.assign(task, updates);
			await this.saveTasks();
		}
	}

	getLastRunTime(routineId: string): number {
		return this.routines[routineId]?.last_run || 0;
	}

	getActiveTaskForRoutine(routineId: string): RoutineTask | undefined {
		return this.tasks.find(t => t.routineId === routineId && (t.status === 'pending' || t.status === 'running'));
	}
}
