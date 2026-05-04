import { App, TFile, Notice } from 'obsidian';
import { LoggerService } from '../services/LoggerService';
import { ExecutionSandbox } from '../sandbox/ExecutionSandbox';
import { RoutineManager, RoutineDefinition } from './RoutineManager';
import { ChatService } from '../services/ChatService';
import { CronExpressionParser } from 'cron-parser';

export class TriggerParser {
	private app: App;
	private logger: LoggerService;
	private sandbox: ExecutionSandbox;
	private routineManager: RoutineManager;
	private chatService: ChatService;

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
			if (!file) return;
			const routines = this.routineManager.getRoutines();
			for (const r of routines) {
				if (r.status === 'active' && r.trigger === 'event(file-open)') {
					void this.executeRoutine(r, `File opened: ${file.path}`);
				}
			}
		});

		// Cron-based triggers (Evaluates every 60 seconds)
		window.setInterval(() => {
			const routines = this.routineManager.getRoutines();
			for (const r of routines) {
				if (r.status === 'active' && r.trigger.startsWith('cron(')) {
					if (this.isCronDue(r)) {
						void this.executeRoutine(r, 'Scheduled cron trigger matched (Catch-up or Scheduled).');
					}
				}
			}
		}, 60000);
	}

	private isCronDue(routine: RoutineDefinition): boolean {
		const exp = routine.trigger.substring(5, routine.trigger.length - 1).trim();
		try {
			const interval = CronExpressionParser.parse(exp);
			const prevTime = interval.prev().getTime();
			
			const state = this.routineManager.getQueueState()[routine.id];
			const lastRunTime = state?.lastRunTime || 0;

			// If the previous scheduled run is newer than our last execution timestamp, we missed it.
			// Add a 5-second buffer to prevent double triggers.
			if (prevTime > (lastRunTime + 5000)) {
				return true;
			}
		} catch (e: any) {
			void this.logger.log('CRON_PARSE_ERROR', { routine: routine.id, error: e.message });
		}
		return false;
	}

	async executeRoutine(routine: RoutineDefinition, contextMsg: string) {
		const state = this.routineManager.getQueueState()[routine.id];
		if (state && state.status === 'running') {
			this.logger.log('ROUTINE_SKIPPED_ALREADY_RUNNING', { routine: routine.id });
			return; // Prevent concurrent runs
		}

		await this.routineManager.updateRoutineState(routine.id, { status: 'running', lastRunTime: Date.now(), lastError: '' });

		try {
			void this.logger.log('ROUTINE_STARTED', { routine: routine.id, agent: routine.agent });
			
			const prompt = `[SYSTEM TRIGGER]: The routine "${routine.name}" has been triggered. \nContext: ${contextMsg}\n\nPlease execute the skill "${routine.skill}" immediately. Use your \`load_skill\` tool to read the SOP instructions, then execute the necessary steps.`;
			
			// Execute via ChatService (Simulated user message from System)
			await this.chatService.sendMessage(prompt, routine.agent);

			await this.routineManager.updateRoutineState(routine.id, { status: 'completed' });
			void this.logger.log('ROUTINE_COMPLETED', { routine: routine.id });
		} catch (e: any) {
			await this.routineManager.updateRoutineState(routine.id, { status: 'failed', lastError: e.message });
			void this.logger.log('ROUTINE_FAILED', { routine: routine.id, error: e.message });
		}
	}
}
