export interface IFileSystem {
	readText(path: string): Promise<string>;
	writeText(path: string, content: string): Promise<void>;
	appendText(path: string, content: string): Promise<void>;
	exists(path: string): Promise<boolean>;
	mkdir(path: string): Promise<void>;
	rename(oldPath: string, newPath: string): Promise<void>;
	delete(path: string): Promise<void>;
	listFiles(dirPath: string): Promise<string[]>;
	getBasePath(): string;
	getConfigDir(): string;
}

export interface INetworkRequestOptions {
	url: string;
	method: string;
	headers?: Record<string, string>;
	body?: string;
}

export interface INetworkResponse {
	status: number;
	json: any;
	text: string;
}

export interface INetwork {
	request(options: INetworkRequestOptions): Promise<INetworkResponse>;
}

export interface IUI {
	notice(msg: string, timeout?: number): void;
	confirm(title: string, msg: string): Promise<boolean>;
}

export interface IProcessRunnerResult {
	stdout: string;
	stderr: string;
}

export interface IProcessRunner {
	run(exe: string, args: string[], cwd: string, env: Record<string, string>): Promise<IProcessRunnerResult>;
}

export interface AgenticContext {
	fs: IFileSystem;
	network: INetwork;
	ui: IUI;
	runner: IProcessRunner;
	// We will gradually move plugin references (settings, logger, engines) into this context
	// to completely remove the Plugin class dependency.
	settings: any; // Temporarily any to avoid circular imports during transition
	saveSettings: () => Promise<void>;
	
	// Engines
	logger?: any;
	personaEngine?: any;
	toolRegistry?: any;
	routineManager?: any;
	approvalQueue?: any;
	executionSandbox?: any;
	mcpEngine?: any;
	chatService?: any;
}
