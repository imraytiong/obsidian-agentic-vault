import { App, TFile, TFolder } from 'obsidian';

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: unknown[];
	language: string;
	scriptContent: string;
	fleet: string;
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

		const fleetsPath = `${this.agenticVaultPath}/fleets`;
		const fleetsFolder = this.app.vault.getAbstractFileByPath(fleetsPath);
		if (!fleetsFolder || !(fleetsFolder instanceof TFolder)) return;

		for (const fleetDir of fleetsFolder.children) {
			if (!(fleetDir instanceof TFolder)) continue;
			
			const fleetName = fleetDir.name;
			
			const fleetMd = this.app.vault.getAbstractFileByPath(`${fleetDir.path}/fleet.md`);
			if (fleetMd && fleetMd instanceof TFile) {
				const cache = this.app.metadataCache.getFileCache(fleetMd);
				if (cache?.frontmatter?.status === 'disabled') continue;
			}

			const toolsPath = `${fleetDir.path}/tools`;
			const folder = this.app.vault.getAbstractFileByPath(toolsPath);
			if (!folder || !(folder instanceof TFolder)) continue;

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

					this.tools[`${fleetName}.${frontmatter.name}`] = {
						name: frontmatter.name,
						description: frontmatter.description || '',
						parameters: frontmatter.parameters || [],
						language: language,
						scriptContent: scriptContent,
						fleet: fleetName
					};
				}
			}
			}
		}
	}

	getTool(name: string, executionFleet?: string): ToolDefinition | undefined {
		// First check local fleet
		if (executionFleet && this.tools[`${executionFleet}.${name}`]) {
			return this.tools[`${executionFleet}.${name}`];
		}
		// Fallback to core fleet
		if (this.tools[`core.${name}`]) {
			return this.tools[`core.${name}`];
		}
		return undefined;
	}

	getAllTools(executionFleet?: string): ToolDefinition[] {
		if (!executionFleet) return Object.values(this.tools);
		
		// Return local tools + core tools (local overrides core if same name)
		const result: Record<string, ToolDefinition> = {};
		for (const tool of Object.values(this.tools)) {
			if (tool.fleet === 'core') {
				result[tool.name] = tool; // lowest priority
			}
		}
		for (const tool of Object.values(this.tools)) {
			if (tool.fleet === executionFleet) {
				result[tool.name] = tool; // highest priority overrides core
			}
		}
		return Object.values(result);
	}
}
