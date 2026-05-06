import { App, TFile } from 'obsidian';

export class LoggerService {
	private app: App;
	public agenticVaultPath: string;

	constructor(app: App, agenticVaultPath: string) {
		this.app = app;
		this.agenticVaultPath = agenticVaultPath;
	}

	private isWriting = false;
	private queue: {action: string, context: Record<string, unknown>}[] = [];

	async log(action: string, context: Record<string, unknown> = {}) {
		this.queue.push({ action, context });
		if (!this.isWriting) {
			this.isWriting = true;
			await this.processQueue();
		}
	}

	private async processQueue() {
		while (this.queue.length > 0) {
			const { action, context } = this.queue.shift()!;
			const timestamp = new Date().toISOString();
			let logContent = '';
			try {
				logContent = JSON.stringify(context, null, 2);
			} catch (e: any) {
				logContent = `[Error stringifying context: ${e.message}]`;
			}
			const logEntry = `\n### [${timestamp}] ${action}\n\`\`\`json\n${logContent}\n\`\`\`\n`;

			if (!this.agenticVaultPath) continue;

			const logsDir = `${this.agenticVaultPath}/logs`;
			const logFilePath = `${logsDir}/Trace_Log.md`;

			try {
				if (!this.app.vault.getAbstractFileByPath(logsDir)) {
					try { await this.app.vault.createFolder(logsDir); } catch(e){}
				}

				let file = this.app.vault.getAbstractFileByPath(logFilePath);
				
				if (file instanceof TFile) {
					await this.app.vault.append(file, logEntry);
				} else {
					const header = `# Agentic Vault Trace Log\n\nThis file is autonomously generated to provide a deterministic ReAct audit trail.\n`;
					try {
						await this.app.vault.create(logFilePath, header + logEntry);
					} catch (e: any) {
						if (e.message && e.message.includes('already exists')) {
							await this.app.vault.adapter.append(logFilePath, logEntry);
						} else {
							console.error("Agentic Vault Logger Error:", e);
						}
					}
				}
			} catch (error) {
				console.error("Agentic Vault Logger Error:", error);
			}
		}
		this.isWriting = false;
	}
}
