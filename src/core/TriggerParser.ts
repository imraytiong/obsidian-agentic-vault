import { App, TFile, Notice } from 'obsidian';
import { LoggerService } from '../services/LoggerService';
import { ExecutionSandbox } from '../sandbox/ExecutionSandbox';
import { getErrorMessage } from '../utils/ErrorUtils';
import { RoutineManager, RoutineDefinition } from './RoutineManager';
import { ChatService } from '../services/ChatService';
import { CronExpressionParser } from 'cron-parser';

export class TriggerParser {
	private app: App;
	private logger: LoggerService;
	private sandbox: ExecutionSandbox;
	private routineManager: RoutineManager;
	private chatService: ChatService;
	private cronInterval?: number;

	constructor(app: App, logger: LoggerService, sandbox: ExecutionSandbox, routineManager: RoutineManager, chatService: ChatService) {
		this.app = app;
		this.logger = logger;
		this.sandbox = sandbox;
		this.routineManager = routineManager;
		this.chatService = chatService;
	}

	registerTriggers() {
		// Event-based triggers
		this.app.workspace.on('file-open', async (file: TFile | null) => {
			if (!this.chatService.plugin.settings.routinesEnabled) return;
			if (!file) return;
			const routines = this.routineManager.getRoutines();
			for (const r of routines) {
				if (r.status === 'active' && r.trigger === 'event(file-open)') {
					void this.executeRoutine(r, `File opened: ${file.path}`);
				}
			}
		});

		// Cron-based triggers
		const evaluateCrons = () => {
			if (!this.chatService.plugin?.settings?.routinesEnabled) return;
			const routines = this.routineManager.getRoutines();
			for (const r of routines) {
				if (r.status === 'active' && r.trigger.startsWith('cron(')) {
					if (this.isCronDue(r)) {
						void this.executeRoutine(r, 'Scheduled cron trigger matched (Catch-up or Scheduled).');
					}
				}
			}
		};

		// Evaluate immediately to catch any missed triggers during offline
		evaluateCrons();
		
		// Then evaluate every 60 seconds
		this.cronInterval = window.setInterval(evaluateCrons, 60000);
	}

	unregisterTriggers() {
		if (this.cronInterval !== undefined) {
			window.clearInterval(this.cronInterval);
		}
	}

	private isCronDue(routine: RoutineDefinition): boolean {
		const exp = routine.trigger.substring(5, routine.trigger.length - 1).trim();
		try {
			const interval = CronExpressionParser.parse(exp);
			const prevTime = interval.prev().getTime();
			
			const lastRunTime = this.routineManager.getLastRunTime(routine.id);

			// If the previous scheduled run is newer than our last execution timestamp, we missed it.
			// Add a 5-second buffer to prevent double triggers.
			if (prevTime > (lastRunTime + 5000)) {
				return true;
			}
		} catch (e: unknown) {
			void this.logger.log('CRON_PARSE_ERROR', { routine: routine.id, error: getErrorMessage(e) });
		}
		return false;
	}

	async executeRoutine(routine: RoutineDefinition, contextMsg: string) {
		const activeTask = this.routineManager.getActiveTaskForRoutine(routine.id);
		if (activeTask) {
			this.logger.log('ROUTINE_SKIPPED_ALREADY_RUNNING', { routine: routine.id });
			return; // Prevent concurrent runs
		}
		const now = Date.now();
		routine.last_run = now;
		await this.routineManager.updateRoutineField(routine.id, 'last_run', now);

		const task = this.routineManager.spawnTask(routine);
		
		const maxAttempts = (routine.retries !== undefined ? routine.retries : 3) + 1;
		let success = false;
		let lastError = '';

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				await this.routineManager.updateTask(task.id, { status: 'running', attempts: attempt });
				
				if (attempt > 1) {
					void this.logger.log('ROUTINE_RETRYING', { routine: routine.id, attempt });
				} else {
					void this.logger.log('ROUTINE_STARTED', { routine: routine.id, agent: routine.agent, taskId: task.id });
				}
				
				const prompt = `[SYSTEM TRIGGER]: The routine "${routine.name}" has been triggered. \nContext: ${contextMsg}\n\nPlease execute the skill "${routine.skill}" immediately. Use your \`load_skill\` tool to read the SOP instructions, then execute the necessary steps.`;
				
				const timeoutMs = (routine.timeout || 5) * 60 * 1000;
				
				const executionPromise = this.chatService.sendMessage(prompt, routine.agent, "System", task.id);
				const timeoutPromise = new Promise((_, reject) => {
					setTimeout(() => reject(new Error(`Routine timed out after ${routine.timeout || 5} minutes`)), timeoutMs);
				});

				await Promise.race([executionPromise, timeoutPromise]);

				await this.routineManager.updateTask(task.id, { status: 'completed', endTime: Date.now() });
				void this.logger.log('ROUTINE_COMPLETED', { routine: routine.id, taskId: task.id });
				success = true;
				break;
			} catch (e: unknown) {
				const errMsg = getErrorMessage(e);
				lastError = errMsg;
				if (errMsg.includes('timed out')) {
					this.chatService.abortBackgroundTask(task.id);
				}
				void this.logger.log('ROUTINE_ATTEMPT_FAILED', { routine: routine.id, attempt, error: lastError });
				
				// Small delay before retrying
				if (attempt < maxAttempts) {
					await new Promise(r => setTimeout(r, 2000));
				}
			}
		}

		if (!success) {
			await this.routineManager.updateTask(task.id, { status: 'failed', error: lastError, endTime: Date.now() });
			void this.logger.log('ROUTINE_FAILED', { routine: routine.id, error: lastError, taskId: task.id });
		}
	}
}
