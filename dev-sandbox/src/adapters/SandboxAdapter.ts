import type { IFileSystem, INetwork, INetworkRequestOptions, INetworkResponse, IUI, IProcessRunner, IProcessRunnerResult } from '../../../src/core/interfaces/Environment';

export class SandboxNetwork implements INetwork {
	async request(options: INetworkRequestOptions): Promise<INetworkResponse> {
		const res = await fetch(options.url, {
			method: options.method,
			headers: options.headers as HeadersInit,
			body: options.body
		});
		return {
			status: res.status,
			json: await res.json().catch(() => ({})),
			text: await res.text().catch(() => '')
		};
	}
}

export class SandboxUI implements IUI {
	notice(msg: string, timeout?: number): void {
		console.log(`[NOTICE]: ${msg}`);
	}
	async confirm(title: string, msg: string): Promise<boolean> {
		return window.confirm(`${title}\n\n${msg}`);
	}
}

export class SandboxFileSystem implements IFileSystem {
	async readText(path: string): Promise<string> {
		const res = await fetch('/api/fs/read', { method: 'POST', body: JSON.stringify({ path }) });
		if (!res.ok) throw new Error(`File not found: ${path}`);
		const data = await res.json();
		return data.content;
	}
	
	async writeText(path: string, content: string): Promise<void> {
		await fetch('/api/fs/write', { method: 'POST', body: JSON.stringify({ path, content }) });
	}
	
	async appendText(path: string, content: string): Promise<void> {
		const existing = await this.exists(path) ? await this.readText(path) : '';
		await this.writeText(path, existing + content);
	}
	
	async exists(path: string): Promise<boolean> {
		const res = await fetch('/api/fs/exists', { method: 'POST', body: JSON.stringify({ path }) });
		const data = await res.json();
		return data.exists;
	}
	
	async mkdir(path: string): Promise<void> {
		await fetch('/api/fs/mkdir', { method: 'POST', body: JSON.stringify({ path }) });
	}
	
	async rename(oldPath: string, newPath: string): Promise<void> {
		await fetch('/api/fs/rename', { method: 'POST', body: JSON.stringify({ oldPath, newPath }) });
	}
	
	async delete(path: string): Promise<void> {
		await fetch('/api/fs/delete', { method: 'POST', body: JSON.stringify({ path }) });
	}
	
	async listFiles(dirPath: string): Promise<string[]> {
		const res = await fetch('/api/fs/list', { method: 'POST', body: JSON.stringify({ path: dirPath }) });
		const data = await res.json();
		return data.files || [];
	}
	
	getBasePath(): string {
		return '/sandbox-root';
	}
	
	getConfigDir(): string {
		return '.sandbox';
	}
}

export class SandboxProcessRunner implements IProcessRunner {
	async run(exe: string, args: string[], cwd: string, env: Record<string, string>): Promise<IProcessRunnerResult> {
		const res = await fetch('/api/exec', {
			method: 'POST',
			body: JSON.stringify({ exe, args, customEnvPath: env.PATH || '' })
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || 'Execution failed');
		return { stdout: data.stdout, stderr: data.stderr };
	}
}
