import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TriggerParser } from '../../src/core/TriggerParser';

describe('TriggerParser', () => {
	let triggerParser: TriggerParser;
	let mockApp: unknown;
	let mockLogger: unknown;
	let mockSandbox: unknown;
	let mockRoutineManager: unknown;
	let mockChatService: unknown;
	
	beforeEach(() => {
		mockApp = { workspace: { on: vi.fn() } };
		mockLogger = { log: vi.fn() };
		mockSandbox = {};
		mockRoutineManager = {
			getRoutines: vi.fn().mockReturnValue([]),
			getLastRunTime: vi.fn().mockReturnValue(0),
			getActiveTaskForRoutine: vi.fn().mockReturnValue(null),
			spawnTask: vi.fn().mockReturnValue({ id: 'task_1' }),
			updateRoutineField: vi.fn(),
			updateTask: vi.fn()
		};
		mockChatService = {
			plugin: { settings: { routinesEnabled: true } },
			sendMessage: vi.fn().mockResolvedValue(true),
			abortBackgroundTask: vi.fn()
		};
		
		(global as unknown).window = global;

		triggerParser = new TriggerParser(mockApp, mockLogger, mockSandbox, mockRoutineManager, mockChatService);
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should register file-open event', () => {
		triggerParser.registerTriggers();
		expect(mockApp.workspace.on).toHaveBeenCalledWith('file-open', expect.any(Function));
	});

	it('should trigger routine when cron is due', () => {
		mockRoutineManager.getRoutines.mockReturnValue([
			{ id: 'r1', name: 'Cron Test', trigger: 'cron(* * * * *)', status: 'active', skill: 'test_skill', agent: 'Concierge' }
		]);
		// Simulate the last run being way in the past so it triggers
		mockRoutineManager.getLastRunTime.mockReturnValue(0);
		
		const executeRoutineSpy = vi.spyOn(triggerParser, 'executeRoutine').mockResolvedValue(undefined);
		triggerParser.registerTriggers();
		
		expect(executeRoutineSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }), expect.any(String));
	});

	it('should NOT trigger routine when cron is NOT due', () => {
		mockRoutineManager.getRoutines.mockReturnValue([
			{ id: 'r1', name: 'Cron Test', trigger: 'cron(0 0 1 1 *)', status: 'active', skill: 'test_skill', agent: 'Concierge' }
		]);
		
		// Simulate last run was recent, so not due
		mockRoutineManager.getLastRunTime.mockReturnValue(Date.now() + 100000); 
		
		const executeRoutineSpy = vi.spyOn(triggerParser, 'executeRoutine').mockResolvedValue(undefined);
		triggerParser.registerTriggers();
		
		expect(executeRoutineSpy).not.toHaveBeenCalled();
	});

	it('should execute routine retries upon failure', async () => {
		const routine = { id: 'r2', name: 'Retry', trigger: 'cron(* * * * *)', status: 'active', skill: 'test_skill', retries: 1 };
		mockChatService.sendMessage
			.mockRejectedValueOnce(new Error('First fail'))
			.mockResolvedValueOnce(true);

		const executePromise = triggerParser.executeRoutine(routine as unknown, 'Test');
		
		// Advance timers to trigger the delay between retries
		await vi.runAllTimersAsync();
		await executePromise;

		expect(mockChatService.sendMessage).toHaveBeenCalledTimes(2);
		expect(mockRoutineManager.updateTask).toHaveBeenCalledWith('task_1', expect.objectContaining({ status: 'completed' }));
	});
});
