import { App, TFile, TFolder, parseYaml } from 'obsidian';

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: unknown[];
	language: string;
	scriptContent: string;
	fleet: string;
}

import { AgenticVaultSettings } from '../settings';

export class ToolRegistry {
	private app: App;
	private settings: AgenticVaultSettings;
	private tools: Record<string, ToolDefinition> = {};

	constructor(app: App, settings: AgenticVaultSettings) {
		this.app = app;
		this.settings = settings;
	}

	async loadTools() {
		this.tools = {};
		if (!this.settings.agenticVaultPath) return;

		const fleetsPath = `${this.settings.agenticVaultPath}/fleets`;
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
					const content = await this.app.vault.read(file);
					let frontmatter: any = null;
					
					// Manually extract frontmatter to avoid cache race conditions on first boot
					const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
					if (fmMatch) {
						try {
							frontmatter = parseYaml(fmMatch[1]);
						} catch (e) {
							console.error(`Failed to parse YAML for tool ${file.path}`, e);
						}
					}
					
					if (frontmatter && frontmatter.name) {
						// Ignore MCP server definition files (McpEngine handles them)
						if (frontmatter.mcp_server === true) continue;
						
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

					// Dynamically inject ZONES_ENUM
					let parameters = frontmatter.parameters || [];
					if (parameters.length > 0) {
						let paramString = JSON.stringify(parameters);
						if (paramString.includes('{{ZONES_ENUM}}')) {
							const zoneKeys = Object.keys(this.settings.zones);
							paramString = paramString.replace(/"\{\{ZONES_ENUM\}\}"/g, JSON.stringify(zoneKeys));
							parameters = JSON.parse(paramString);
						}
					}

					this.tools[`${fleetName}.${frontmatter.name}`] = {
						name: frontmatter.name,
						description: frontmatter.description || '',
						parameters: parameters,
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
