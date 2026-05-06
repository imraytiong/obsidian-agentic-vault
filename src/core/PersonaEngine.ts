import { App, TFile, TFolder } from 'obsidian';

export interface Persona {
	id: string;
	name: string;
	cmd: string;
	description?: string;
	skills?: string[];
	systemPrompt: string;
	fleet: string;
}

export class PersonaEngine {
	private app: App;
	private agenticVaultPath: string;
	private personas: Record<string, Persona> = {};

	constructor(app: App, agenticVaultPath: string) {
		this.app = app;
		this.agenticVaultPath = agenticVaultPath;
	}

	async loadPersonas() {
		this.personas = {}; // Clear existing

		if (!this.agenticVaultPath) return;

		const fleetsPath = `${this.agenticVaultPath}/fleets`;
		const fleetsFolder = this.app.vault.getAbstractFileByPath(fleetsPath);
		if (!fleetsFolder || !(fleetsFolder instanceof TFolder)) return;

		for (const fleetDir of fleetsFolder.children) {
			if (!(fleetDir instanceof TFolder)) continue;
			
			const fleetName = fleetDir.name;
			
			// Optional: check fleet.md for status: active?
			const fleetMd = this.app.vault.getAbstractFileByPath(`${fleetDir.path}/fleet.md`);
			if (fleetMd && fleetMd instanceof TFile) {
				const cache = this.app.metadataCache.getFileCache(fleetMd);
				if (cache?.frontmatter?.status === 'disabled') continue;
			}

			const personasPath = `${fleetDir.path}/personas`;
			const folder = this.app.vault.getAbstractFileByPath(personasPath);
			if (!folder || !(folder instanceof TFolder)) continue;

			for (const file of folder.children) {
				if (file instanceof TFile && file.extension === 'md') {
					const content = await this.app.vault.cachedRead(file);
					
					// Manually extract frontmatter in case metadataCache is still indexing newly created files
					let frontmatter: Record<string, any> = {};
					if (content.startsWith('---')) {
						const endOfFrontmatter = content.indexOf('---', 3);
						if (endOfFrontmatter !== -1) {
							const yaml = content.substring(3, endOfFrontmatter);
							const nameMatch = yaml.match(/name:\s*([^\n]+)/);
							const cmdMatch = yaml.match(/cmd:\s*([^\n]+)/);
							const descMatch = yaml.match(/description:\s*([^\n]+)/);
							if (nameMatch) frontmatter.name = nameMatch[1].trim();
							if (cmdMatch) frontmatter.cmd = cmdMatch[1].trim();
							if (descMatch) frontmatter.description = descMatch[1].trim();
						}
					}
					
					if (frontmatter.name && frontmatter.cmd) {
						// Simple extraction: strip YAML frontmatter
						let systemPrompt = content;
						if (content.startsWith('---')) {
							const endOfFrontmatter = content.indexOf('---', 3);
							if (endOfFrontmatter !== -1) {
								systemPrompt = content.substring(endOfFrontmatter + 3).trim();
							}
						}
						
						let parsedCmd = frontmatter.cmd;
						if (!parsedCmd.startsWith('/')) {
							parsedCmd = '/' + parsedCmd;
						}

						const description = typeof frontmatter.description === 'string' ? frontmatter.description : undefined;
						const skills = Array.isArray(frontmatter.skills) ? frontmatter.skills.map(String) : [];

						this.personas[frontmatter.name] = {
							id: file.basename,
							name: frontmatter.name,
							cmd: parsedCmd,
							description,
							skills,
							systemPrompt: systemPrompt,
							fleet: fleetName
						};
					}
				}
			}
		}
	}

	getPersonaByName(name: string): Persona | undefined {
		return Object.values(this.personas).find(p => p.name === name);
	}

	getAllPersonas(): Persona[] {
		return Object.values(this.personas);
	}
}
