import { App, TFile, Notice } from 'obsidian';
import { LoggerService } from '../services/LoggerService';

import { ExecutionSandbox } from '../sandbox/ExecutionSandbox';

export class TriggerParser {
	private app: App;
	private logger: LoggerService;
	private sandbox: ExecutionSandbox;

	constructor(app: App, logger: LoggerService, sandbox: ExecutionSandbox) {
		this.app = app;
		this.logger = logger;
		this.sandbox = sandbox;
	}

	registerTriggers() {
		// Hook into file modifications
		this.app.workspace.on('file-open', async (file: TFile | null) => {
			if (!file) return;
			
			// Quick read of the file content
			const content = await this.app.vault.cachedRead(file);
			
			// If file has a specific tag, trigger an async notice
			if (content.includes('#sherpa-trigger')) {
				this.logger.log('ASYNC_TRIGGER_DETECTED', { file: file.path });
				new Notice(`Agentic Vault: Async trigger detected in ${file.basename}!`);
			}
		});

		// Background Jobs
		this.app.workspace.onLayoutReady(() => {
			setTimeout(async () => {
				this.logger.log('BACKGROUND_JOB_STARTED', { job: 'map_vault' });
				const result = await this.sandbox.executeTool('map_vault', { targetPath: '.' });
				if (result.success) {
					this.logger.log('BACKGROUND_JOB_COMPLETED', { job: 'map_vault', bytes: result.output.length });
				} else {
					this.logger.log('BACKGROUND_JOB_FAILED', { job: 'map_vault', error: result.output });
				}
			}, 5000); // Wait 5 seconds after load to prevent blocking UI
		});
	}
}
