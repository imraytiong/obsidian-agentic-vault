import fs from 'fs';
import path from 'path';
import https from 'https';
import { spawn } from 'child_process';
import type { IFileSystem, INetwork, INetworkRequestOptions, INetworkResponse, IUI, IProcessRunner, IProcessRunnerResult } from '../../../src/core/interfaces/Environment';

export class NodeNetwork implements INetwork {
	async request(options: INetworkRequestOptions): Promise<INetworkResponse> {
		return new Promise((resolve, reject) => {
			const url = new URL(options.url);
			const req = https.request(url, {
				method: options.method,
				headers: options.headers as any
			}, (res) => {
				let body = '';
				res.on('data', chunk => body += chunk);
				res.on('end', () => {
					let json = {};
					try { json = JSON.parse(body); } catch (e) {}
					resolve({ status: res.statusCode || 200, json, text: body });
				});
			});
			req.on('error', reject);
			if (options.body) req.write(options.body);
			req.end();
		});
	}
}

export class NodeUI implements IUI {
	notice(msg: string, timeout?: number): void {
		console.log(`[UI NOTICE]: ${msg}`);
	}
	async confirm(title: string, msg: string): Promise<boolean> {
		console.log(`[UI CONFIRM]: ${title} - ${msg} (Auto-accepting for headless test)`);
		return true;
	}
}

export class NodeFileSystem implements IFileSystem {
	private basePath: string;

	constructor(basePath: string) {
		this.basePath = path.resolve(basePath);
		if (!fs.existsSync(this.basePath)) {
			fs.mkdirSync(this.basePath, { recursive: true });
		}
	}

	private resolvePath(relativePath: string): string {
		return path.join(this.basePath, relativePath);
	}

	async readText(p: string): Promise<string> {
		return fs.promises.readFile(this.resolvePath(p), 'utf-8');
	}
	
	async writeText(p: string, content: string): Promise<void> {
		const fullPath = this.resolvePath(p);
		await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
		await fs.promises.writeFile(fullPath, content, 'utf-8');
	}
	
	async appendText(p: string, content: string): Promise<void> {
		const fullPath = this.resolvePath(p);
		if (fs.existsSync(fullPath)) {
			const existing = await fs.promises.readFile(fullPath, 'utf-8');
			await fs.promises.writeFile(fullPath, existing + content, 'utf-8');
		} else {
			await this.writeText(p, content);
		}
	}
	
	async exists(p: string): Promise<boolean> {
		return fs.existsSync(this.resolvePath(p));
	}
	
	async mkdir(p: string): Promise<void> {
		await fs.promises.mkdir(this.resolvePath(p), { recursive: true });
	}
	
	async rename(oldPath: string, newPath: string): Promise<void> {
		await fs.promises.rename(this.resolvePath(oldPath), this.resolvePath(newPath));
	}
	
	async delete(p: string): Promise<void> {
		const fullPath = this.resolvePath(p);
		if (fs.existsSync(fullPath)) {
			const stat = await fs.promises.stat(fullPath);
			if (stat.isDirectory()) {
				await fs.promises.rm(fullPath, { recursive: true, force: true });
			} else {
				await fs.promises.unlink(fullPath);
			}
		}
	}
	
	async listFiles(dirPath: string): Promise<string[]> {
		const fullPath = this.resolvePath(dirPath);
		if (!fs.existsSync(fullPath)) return [];
		const files = await fs.promises.readdir(fullPath);
		return files.map(f => path.join(dirPath, f));
	}
	
	getBasePath(): string {
		return this.basePath;
	}
	
	getConfigDir(): string {
		return '.obsidian';
	}
}

export class NodeProcessRunner implements IProcessRunner {
	async run(command: string, args: string[], cwd?: string, env?: Record<string, string>): Promise<IProcessRunnerResult> {
		return new Promise((resolve) => {
			const actualCommand = command === 'node' ? process.execPath : command;
			const child = spawn(actualCommand, args, { cwd: cwd || process.cwd(), env: env || (process.env as any) });
			let stdout = '';
			let stderr = '';
			child.stdout.on('data', (data) => stdout += data.toString());
			child.stderr.on('data', (data) => stderr += data.toString());
			child.on('error', (err) => resolve({ exitCode: 1, stdout: '', stderr: err.message }));
			child.on('close', (code) => {
				resolve({ exitCode: code || 0, stdout, stderr });
			});
		});
	}
}
