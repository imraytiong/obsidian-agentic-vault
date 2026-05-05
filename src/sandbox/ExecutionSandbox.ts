import { App } from 'obsidian';
import { LoggerService } from '../services/LoggerService';
import { ToolRegistry } from './ToolRegistry';
import { spawn } from 'child_process';

import { AgenticVaultSettings } from '../settings';

export class ExecutionSandbox {
	private app: App;
	private logger: LoggerService;
	private toolRegistry: ToolRegistry;
	private settings: AgenticVaultSettings;

	constructor(app: App, logger: LoggerService, toolRegistry: ToolRegistry, settings: AgenticVaultSettings) {
		this.app = app;
		this.logger = logger;
		this.toolRegistry = toolRegistry;
		this.settings = settings;
	}

	async executeTool(toolName: string, payload: unknown, executionFleet?: string): Promise<{ success: boolean, output: string }> {
		const tool = this.toolRegistry.getTool(toolName, executionFleet);
		if (!tool) {
			return { success: false, output: `Tool not found: ${toolName}` };
		}

		this.logger.log('SANDBOX_EXECUTION_STARTED', { tool: toolName, engine: this.settings.sandboxEngine, payload });

		try {
			let enrichedPayload = payload;
			if (typeof payload === 'object' && payload !== null) {
				enrichedPayload = { 
					...payload, 
					__ZONES__: this.settings.zones,
					__VAULT_ROOT__: (this.app.vault.adapter as any).basePath || ''
				};
			}
			const payloadString = JSON.stringify(enrichedPayload);
			let exe = '';
			let args: string[] = [];

			let lang = tool.language;
			if (lang === 'js' || lang === 'javascript' || lang === 'ts' || lang === 'typescript') {
				if (this.settings.sandboxEngine === 'local-node') {
					exe = 'node';
					args = ['-e', tool.scriptContent, payloadString];
				} else if (this.settings.sandboxEngine === 'docker') {
					exe = 'docker';
					args = ['run', '--rm', '-i', 'node:18', 'node', '-e', tool.scriptContent, payloadString];
				} else if (this.settings.sandboxEngine === 'podman') {
					exe = 'podman';
					args = ['run', '--rm', '-i', 'node:18', 'node', '-e', tool.scriptContent, payloadString];
				}
			} else if (lang === 'python' || lang === 'py') {
				if (this.settings.sandboxEngine === 'local-node') {
					exe = 'python3';
					args = ['-c', tool.scriptContent, payloadString];
				} else if (this.settings.sandboxEngine === 'docker') {
					exe = 'docker';
					args = ['run', '--rm', '-i', 'python:3', 'python', '-c', tool.scriptContent, payloadString];
				} else if (this.settings.sandboxEngine === 'podman') {
					exe = 'podman';
					args = ['run', '--rm', '-i', 'python:3', 'python', '-c', tool.scriptContent, payloadString];
				}
			} else if (lang === 'bash' || lang === 'sh') {
				if (this.settings.sandboxEngine === 'local-node') {
					exe = 'bash';
					args = ['-c', tool.scriptContent, payloadString];
				} else {
					exe = this.sandboxEngine;
					args = ['run', '--rm', '-i', 'alpine', 'sh', '-c', tool.scriptContent, payloadString];
				}
			} else {
				return { success: false, output: `Unsupported language block: ${lang}` };
			}

			const output = await new Promise<{stdout: string, stderr: string}>((resolve, reject) => {
				const augmentedEnv = { ...process.env, PATH: `${this.settings.customEnvPath}:${process.env.PATH || ''}` };
				const vaultPath = (this.app.vault.adapter as unknown as any).getBasePath ? (this.app.vault.adapter as unknown as any).getBasePath() : process.cwd();
				const child = spawn(exe, args, { env: augmentedEnv, cwd: vaultPath });
				let stdout = '';
				let stderr = '';
				child.stdout.on('data', (d: unknown) => stdout += d.toString());
				child.stderr.on('data', (d: unknown) => stderr += d.toString());
				child.on('close', (code: number) => {
					if (code === 0) resolve({stdout, stderr});
					else reject(new Error(stdout || stderr || `Process exited with code ${code}`));
				});
				child.on('error', (err: unknown) => reject(err));
			});
			
			if (output.stderr) {
				this.logger.log('SANDBOX_EXECUTION_STDERR', { tool: toolName, stderr: output.stderr });
			}

			// Side-Effect Verification Middleware
			let parsedOutput: any;
			try {
				parsedOutput = JSON.parse(output.stdout.trim());
			} catch (e) {
				// Not JSON, just skip
			}
			
			if (parsedOutput && Array.isArray(parsedOutput.side_effects)) {
				for (const effect of parsedOutput.side_effects) {
					if (!effect.path) continue;
					const exists = await this.app.vault.adapter.exists(effect.path);
					if (effect.type === 'write' || effect.type === 'mkdir') {
						if (!exists) {
							const errorMsg = `VERIFICATION_FAILED: The tool reported success, but the file system verification failed. The path '${effect.path}' does not exist on disk.`;
							this.logger.log('SANDBOX_VERIFICATION_FAILED', { tool: toolName, effect, errorMsg });
							return { success: false, output: errorMsg };
						}
					} else if (effect.type === 'delete') {
						if (exists) {
							const errorMsg = `VERIFICATION_FAILED: The tool reported success, but the file system verification failed. The path '${effect.path}' still exists on disk.`;
							this.logger.log('SANDBOX_VERIFICATION_FAILED', { tool: toolName, effect, errorMsg });
							return { success: false, output: errorMsg };
						}
					}
				}
			}

			this.logger.log('SANDBOX_EXECUTION_SUCCESS', { tool: toolName, stdout: output.stdout.trim() });
			return { success: true, output: output.stdout.trim() };
		} catch (error: unknown) {
			this.logger.log('SANDBOX_EXECUTION_ERROR', { tool: toolName, error: error.message });
			return { success: false, output: `Execution failed: ${error.message}` };
		}
	}
}
