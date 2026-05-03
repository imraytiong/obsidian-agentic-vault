import { App, TFile, TFolder } from 'obsidian';

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: unknown[];
	language: string;
	scriptContent: string;
}

export class ToolRegistry {
	private app: App;
	private agenticVaultPath: string;
	private tools: Record<string, ToolDefinition> = {};

	constructor(app: App, agenticVaultPath: string) {
		this.app = app;
		this.agenticVaultPath = agenticVaultPath;
	}

	async loadTools() {
		this.tools = {};
		if (!this.agenticVaultPath) return;

		const toolsPath = `${this.agenticVaultPath}/tools`;
		const folder = this.app.vault.getAbstractFileByPath(toolsPath);
		
		if (!folder || !(folder instanceof TFolder)) return;

		for (const file of folder.children) {
			if (file instanceof TFile && file.extension === 'md') {
				const cache = this.app.metadataCache.getFileCache(file);
				const frontmatter = cache?.frontmatter;
				
				if (frontmatter && frontmatter.name) {
					// Ignore MCP server definition files (McpEngine handles them)
					if (frontmatter.mcp_server === true) continue;

					const content = await this.app.vault.cachedRead(file);
					
					let scriptContent = '';
					let language = 'javascript'; // default

					// Extract code block
					const codeBlockRegex = /```([a-z0-9]+)?\n([\s\S]*?)```/i;
					const match = content.match(codeBlockRegex);
					
					if (match) {
						language = match[1] ? match[1].toLowerCase() : 'javascript';
						scriptContent = (match[2] || '').trim();
					} else {
						// Fallback if no code block found
						if (content.startsWith('---')) {
							const endOfFrontmatter = content.indexOf('---', 3);
							if (endOfFrontmatter !== -1) {
								scriptContent = content.substring(endOfFrontmatter + 3).trim();
							}
						}
					}

					this.tools[frontmatter.name] = {
						name: frontmatter.name,
						description: frontmatter.description || '',
						parameters: frontmatter.parameters || [],
						language: language,
						scriptContent: scriptContent
					};
				}
			}
		}
	}

	getTool(name: string): ToolDefinition | undefined {
		return this.tools[name];
	}

	getAllTools(): ToolDefinition[] {
		return Object.values(this.tools);
	}
}
