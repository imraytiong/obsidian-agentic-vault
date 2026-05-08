/* global process */
import { App, TFile, TFolder, parseYaml } from 'obsidian';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface McpServerConfig {
	name?: string;
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	type?: 'stdio' | 'sse';
	uri?: string;
}

export interface McpTool {
	name: string;
	description?: string;
	inputSchema?: {
		type?: string;
		properties?: Record<string, unknown>;
		required?: string[];
	};
	_serverName: string;
	_originalName: string;
	_isSyntheticBatch?: boolean;
	_baseToolName?: string;
}

export class McpEngine {
	private app: App;
	private agenticVaultPath: string;
	private customEnvPath: string;
	public clients: Record<string, Client> = {};
	public availableTools: Record<string, McpTool> = {};

	constructor(app: App, agenticVaultPath: string, customEnvPath: string = '') {
		this.app = app;
		this.agenticVaultPath = agenticVaultPath;
		this.customEnvPath = customEnvPath;
	}

	async initialize() {
		// Clean up existing connections
		this.clients = {};
		this.availableTools = {};

		const fleetsPath = `${this.agenticVaultPath}/fleets`;
		const fleetsFolder = this.app.vault.getAbstractFileByPath(fleetsPath);
		if (!fleetsFolder || !(fleetsFolder instanceof TFolder)) return;

		for (const fleetDir of fleetsFolder.children) {
			if (!(fleetDir instanceof TFolder)) continue;
			
			const fleetMd = this.app.vault.getAbstractFileByPath(`${fleetDir.path}/fleet.md`);
			if (fleetMd && fleetMd instanceof TFile) {
				const cache = this.app.metadataCache.getFileCache(fleetMd);
				if (cache?.frontmatter?.status === 'disabled') continue;
			}

			const serversPath = `${fleetDir.path}/tools`;
			const folder = this.app.vault.getAbstractFileByPath(serversPath);
			if (!folder || !(folder instanceof TFolder)) continue;

			for (const file of folder.children) {
				if (file instanceof TFile && file.extension === 'md') {
					let frontmatter: unknown = null;
					const cache = this.app.metadataCache.getFileCache(file);
					
					if (cache && cache.frontmatter) {
						frontmatter = cache.frontmatter;
					} else {
						// Fallback to manual parse if cache is empty on startup
						const content = await this.app.vault.read(file);
						const match = content.match(/^---\n([\s\S]*?)\n---/);
						if (match) {
							try {
								frontmatter = parseYaml(match[1] || '') as Record<string, unknown>;
								if (frontmatter && typeof frontmatter === 'object' && 'name' in frontmatter && typeof frontmatter.name === 'string' && 'mcp_server' in frontmatter && frontmatter.mcp_server === true) {
									void this.connectServer(frontmatter.name, frontmatter as unknown as McpServerConfig);
								}
							} catch (e) {
								console.error("YAML Parse Error", e);
							}
							continue; // Handle async parseYaml
						}
					}
					
					if (frontmatter && typeof frontmatter === 'object' && 'name' in frontmatter && typeof frontmatter.name === 'string' && 'mcp_server' in frontmatter && frontmatter.mcp_server === true) {
						await this.connectServer(frontmatter.name, frontmatter as unknown as McpServerConfig);
					}
				}
			}
		}
	}

	private async connectServer(name: string, config: McpServerConfig) {
		try {
			const client = new Client(
				{ name: `agentic-vault-${name}`, version: "1.0.0" },
				{ capabilities: {} }
			);

			if (!config.type || config.type === 'stdio') {
				if (!config.command) throw new Error("Missing command for stdio server");
				
				const mergedEnv = { ...process.env, ...(config.env || {}) };
				if (this.customEnvPath) {
					mergedEnv.PATH = `${this.customEnvPath}:${mergedEnv.PATH || ''}`;
				}
				
				const cleanEnv: Record<string, string> = {};
				for (const [k, v] of Object.entries(mergedEnv)) {
					if (v !== undefined) cleanEnv[k] = String(v);
				}

				const transport = new StdioClientTransport({
					command: config.command,
					args: config.args || [],
					env: cleanEnv
				});
				
				await client.connect(transport);
			} else if (config.type === 'sse') {
				// eslint-disable-next-line @typescript-eslint/no-deprecated
				const { SSEClientTransport } = await import("@modelcontextprotocol/sdk/client/sse.js");
				if (!config.uri) throw new Error("Missing uri for sse server");
				
				const transport = new SSEClientTransport(new URL(config.uri));
				await client.connect(transport);
			}

			this.clients[name] = client;
			
			// Fetch tools
			const toolResponse = await client.listTools();
			
			if (toolResponse && toolResponse.tools) {
				for (const tool of toolResponse.tools) {
					const toolId = `${name}___${tool.name}`;
					this.availableTools[toolId] = {
						...tool,
						_serverName: name,
						_originalName: tool.name
					};

					// Inject Synthetic Batch Tools
					if (tool.name === 'gmail.get') {
						const batchToolId = `${name}___gmail.get_batch`;
						this.availableTools[batchToolId] = {
							name: 'gmail.get_batch',
							description: 'Batch fetch multiple emails at once to save LLM turns. Provide an array of message IDs.',
							inputSchema: {
								type: "object",
								properties: {
									messageIds: {
										type: "array",
										items: { type: "string" },
										description: "An array of email message IDs to fetch."
									}
								},
								required: ["messageIds"]
							},
							_serverName: name,
							_originalName: 'gmail.get_batch',
							_isSyntheticBatch: true,
							_baseToolName: 'gmail.get'
						};
					}
				}
			}
			console.debug(`Connected to MCP Server: ${name} with ${toolResponse?.tools?.length || 0} tools.`);
			void this.app.vault.adapter.append('AgenticVault/logs/mcp_debug.txt', `\n[${new Date().toISOString()}] Connected to MCP Server: ${name} with ${toolResponse?.tools?.length || 0} tools.`);
			
		} catch (e: unknown) {
			console.error(`Failed to connect to MCP Server ${name}:`, e);
			void this.app.vault.adapter.append('AgenticVault/logs/mcp_debug.txt', `\n[${new Date().toISOString()}] Failed to connect to MCP Server ${name}: ${(e as Error).message}`);
		}
	}

	getMcpToolsAsRegistryFormat(): import('../sandbox/ToolRegistry').ToolDefinition[] {
		return Object.values(this.availableTools).map(t => ({
			name: `${t._serverName}___${t._originalName}`, // The prefixed name
			description: t.description || `Provided by MCP Server: ${t._serverName}`,
			language: 'mcp',
			scriptContent: '',
			fleet: t._serverName,
			parameters: t.inputSchema || [] 
		}));
	}

	async executeTool(toolId: string, args: Record<string, unknown>): Promise<unknown> {
		const tool = this.availableTools[toolId];
		if (!tool) throw new Error(`MCP Tool ${toolId} not found`);

		const client = this.clients[tool._serverName];
		if (!client) throw new Error(`MCP Client ${tool._serverName} not connected`);

		// Handle Synthetic Batch Tools
		if (tool._isSyntheticBatch && tool._baseToolName === 'gmail.get') {
			const messageIds = args.messageIds || [];
			if (!Array.isArray(messageIds)) throw new Error("messageIds must be an array");

			const results = await Promise.all(
				messageIds.map(async (msgId) => {
					try {
						return await client.callTool({
							name: tool._baseToolName!,
							arguments: { messageId: msgId }
						});
					} catch (e: unknown) {
						return { error: `Failed to fetch message ${msgId}: ${(e as Error).message}` };
					}
				})
			);
			
			return {
				_note: `Batch fetch returned ${results.length} emails.`,
				results
			};
		}

		// Standard Execution
		const result = await client.callTool({
			name: tool._originalName,
			arguments: args
		});

		return result;
	}
}
