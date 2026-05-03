import { App, TFile, TFolder } from 'obsidian';

export interface Persona {
	id: string;
	name: string;
	cmd: string;
	description?: string;
	skills?: string[];
	systemPrompt: string;
}

export class PersonaEngine {
	private app: App;
	private sherpaPath: string;
	private personas: Record<string, Persona> = {};

	constructor(app: App, sherpaPath: string) {
		this.app = app;
		this.sherpaPath = sherpaPath;
	}

	async loadPersonas() {
		this.personas = {}; // Clear existing

		if (!this.sherpaPath) return;

		const personasPath = `${this.sherpaPath}/personas`;
		const folder = this.app.vault.getAbstractFileByPath(personasPath);
		if (!folder || !(folder instanceof TFolder)) return;

		for (const file of folder.children) {
			if (file instanceof TFile && file.extension === 'md') {
				const cache = this.app.metadataCache.getFileCache(file);
				const frontmatter = cache?.frontmatter as Record<string, unknown> | undefined;
				
				if (frontmatter && typeof frontmatter.name === 'string' && typeof frontmatter.cmd === 'string') {
					const content = await this.app.vault.cachedRead(file);
					
					// Simple extraction: strip YAML frontmatter
					let systemPrompt = content;
					if (content.startsWith('---')) {
						const endOfFrontmatter = content.indexOf('---', 3);
						if (endOfFrontmatter !== -1) {
							systemPrompt = content.substring(endOfFrontmatter + 3).trim();
						}
					}

					// Automatically prepend '/' if the user omitted it
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
						systemPrompt: systemPrompt
					};
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
