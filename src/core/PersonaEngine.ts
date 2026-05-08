import { App, TFile, TFolder, parseYaml } from 'obsidian';

export interface Persona {
	id: string;
	name: string;
	cmd: string;
	emoji?: string;
	description?: string;
	skills?: string[];
	capabilities?: string[];
	allowed_zones?: Record<string, string>;
	systemPrompt: string;
	fleet: string;
	model_preference?: {
		target: string;
		allow_fallback: boolean;
	};
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
					const content = await this.app.vault.read(file);
					
					// Manually extract frontmatter to avoid cache race conditions on first boot
					let frontmatter: Record<string, unknown> = {};
					const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
					if (fmMatch) {
						try {
							frontmatter = (parseYaml(fmMatch[1] || '') || {}) as Record<string, unknown>;
						} catch (e) {
							console.error(`Failed to parse YAML for persona ${file.path}`, e);
						}
					}
					
					if (typeof frontmatter.name === 'string' && typeof frontmatter.cmd === 'string') {
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
						const emoji = typeof frontmatter.emoji === 'string' ? frontmatter.emoji : undefined;
						const skills = Array.isArray(frontmatter.skills) ? frontmatter.skills.map(String) : [];
						const capabilities = Array.isArray(frontmatter.capabilities) ? frontmatter.capabilities.map(String) : skills;
						const allowed_zones = typeof frontmatter.allowed_zones === 'object' && frontmatter.allowed_zones !== null 
							? (frontmatter.allowed_zones as Record<string, string>) 
							: undefined;

						this.personas[frontmatter.name] = {
							id: file.basename,
							name: frontmatter.name,
							cmd: parsedCmd,
							emoji,
							description,
							skills,
							capabilities,
							allowed_zones,
							systemPrompt: systemPrompt,
							fleet: fleetName,
							model_preference: frontmatter.model_preference as { target: string, allow_fallback: boolean } | undefined
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
