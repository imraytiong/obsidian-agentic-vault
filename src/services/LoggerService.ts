import { App, TFile } from 'obsidian';

export class LoggerService {
	private app: App;
	private agenticVaultPath: string;

	constructor(app: App, agenticVaultPath: string) {
		this.app = app;
		this.agenticVaultPath = agenticVaultPath;
	}

	async log(action: string, context: Record<string, unknown> = {}) {
		const timestamp = new Date().toISOString();
		const logEntry = `\n### [${timestamp}] ${action}\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\n`;

		if (!this.agenticVaultPath) return;

		const logsDir = `${this.agenticVaultPath}/logs`;
		const logFilePath = `${logsDir}/Trace_Log.md`;

		try {
			if (!this.app.vault.getAbstractFileByPath(logsDir)) {
				await this.app.vault.createFolder(logsDir);
			}

			let file = this.app.vault.getAbstractFileByPath(logFilePath);
			
			if (file instanceof TFile) {
				await this.app.vault.append(file, logEntry);
			} else {
				// File doesn't exist, create it with a header
				const header = `# Agentic Vault Trace Log\n\nThis file is autonomously generated to provide a deterministic ReAct audit trail.\n`;
				await this.app.vault.create(logFilePath, header + logEntry);
			}
		} catch (error) {
			console.error("Agentic Vault Logger Error:", error);
		}
	}
}
