import { spawn } from 'child_process';
import type { IFileSystem, INetwork, INetworkRequestOptions, INetworkResponse, IUI, IProcessRunner, IProcessRunnerResult } from '../core/interfaces/Environment';

export class ObsidianNetwork implements INetwork {
	async request(options: INetworkRequestOptions): Promise<INetworkResponse> {
		const res = await requestUrl({
			url: options.url,
			method: options.method,
			headers: options.headers,
			body: options.body
		});
		return {
			status: res.status,
			json: res.json,
			text: res.text
		};
	}
}

export class ObsidianUI implements IUI {
	notice(msg: string, timeout?: number): void {
		new Notice(msg, timeout);
	}
	async confirm(title: string, msg: string): Promise<boolean> {
		return window.confirm(`${title}\n\n${msg}`);
	}
}

export class ObsidianProcessRunner implements IProcessRunner {
	async run(exe: string, args: string[], cwd: string, env: Record<string, string>): Promise<IProcessRunnerResult> {
		return new Promise<IProcessRunnerResult>((resolve, reject) => {
			const child = spawn(exe, args, { cwd, env });
			let stdout = '';
			let stderr = '';
			child.stdout.on('data', (d: unknown) => stdout += d.toString());
			child.stderr.on('data', (d: unknown) => stderr += d.toString());
			child.on('close', (code: number) => {
				if (code === 0) resolve({ stdout, stderr });
				else reject(new Error(stdout || stderr || `Process exited with code ${code}`));
			});
			child.on('error', (err: unknown) => reject(err));
		});
	}
}

export class ObsidianFileSystem implements IFileSystem {
	private app: App;
	
	constructor(app: App) {
		this.app = app;
	}
	
	async readText(path: string): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
		if (file instanceof TFile) {
			return await this.app.vault.read(file);
		}
		throw new Error(`File not found: ${path}`);
	}
	
	async writeText(path: string, content: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
		if (file instanceof TFile) {
			await this.app.vault.modify(file, content);
		} else {
			await this.app.vault.create(normalizePath(path), content);
		}
	}
	
	async appendText(path: string, content: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
		if (file instanceof TFile) {
			await this.app.vault.append(file, content);
		} else {
			await this.app.vault.create(normalizePath(path), content);
		}
	}
	
	async exists(path: string): Promise<boolean> {
		return this.app.vault.getAbstractFileByPath(normalizePath(path)) !== null;
	}
	
	async mkdir(path: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(normalizePath(path));
		if (!folder) {
			await this.app.vault.createFolder(normalizePath(path));
		}
	}
	
	async rename(oldPath: string, newPath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(normalizePath(oldPath));
		if (file) {
			await this.app.fileManager.renameFile(file, normalizePath(newPath));
		}
	}
	
	async delete(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
		if (file) {
			await this.app.vault.delete(file);
		}
	}
	
	async listFiles(dirPath: string): Promise<string[]> {
		const folder = this.app.vault.getAbstractFileByPath(normalizePath(dirPath));
		if (folder instanceof TFolder) {
			const files: string[] = [];
			for (const child of folder.children) {
				if (child instanceof TFile) {
					files.push(child.path);
				}
			}
			return files;
		}
		return [];
	}
	
	getBasePath(): string {
		return (this.app.vault.adapter as any).getBasePath();
	}
	
	getConfigDir(): string {
		return this.app.vault.configDir;
	}
}
