import { App, TFile, TFolder } from 'obsidian';

export interface SkillDefinition {
	id: string; // The folder name
	name: string;
	description: string;
	body: string; // The contents of SKILL.md
	fleet: string;
}

export class SkillsEngine {
	private app: App;
	private agenticVaultPath: string;
	private skills: Record<string, SkillDefinition> = {};

	constructor(app: App, agenticVaultPath: string) {
		this.app = app;
		this.agenticVaultPath = agenticVaultPath;
	}

	async loadSkills() {
		this.skills = {};
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

			const skillsPath = `${fleetDir.path}/skills`;
			const folder = this.app.vault.getAbstractFileByPath(skillsPath);
			if (!folder || !(folder instanceof TFolder)) continue;

			for (const child of folder.children) {
			// A skill is a folder containing a SKILL.md
			if (child instanceof TFolder) {
				const skillFile = child.children.find((c): c is TFile => c instanceof TFile && c.name === 'SKILL.md');
				if (skillFile) {
					const cache = this.app.metadataCache.getFileCache(skillFile);
					const frontmatter = cache?.frontmatter as Record<string, unknown> | undefined;
					if (frontmatter && typeof frontmatter.name === 'string') {
						let content = await this.app.vault.cachedRead(skillFile);
						let body = content;
						if (content.startsWith('---')) {
							const endOfFrontmatter = content.indexOf('---', 3);
							if (endOfFrontmatter !== -1) {
								body = content.substring(endOfFrontmatter + 3).trim();
							}
						}
						
						this.skills[`${fleetName}.${child.name}`] = {
							id: child.name,
							name: frontmatter.name,
							description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
							body: body,
							fleet: fleetName
						};
					}
				}
			}
			}
		}
	}

	getSkillCatalog(executionFleet?: string): { id: string, name: string, description: string }[] {
		// Like tools, we filter by execution fleet + core
		const available = Object.values(this.skills).filter(s => 
			!executionFleet || s.fleet === executionFleet || s.fleet === 'core'
		);
		// Deduplicate, local fleet overrides core
		const deduped: Record<string, SkillDefinition> = {};
		for (const s of available) {
			if (s.fleet === 'core') deduped[s.id] = s;
		}
		for (const s of available) {
			if (s.fleet === executionFleet) deduped[s.id] = s;
		}

		return Object.values(deduped).map(s => ({
			id: s.id,
			name: s.name,
			description: s.description
		}));
	}

	getSkillBody(id: string, executionFleet?: string): string | null {
		if (executionFleet) {
			const localSkill = this.skills[`${executionFleet}.${id}`];
			if (localSkill) return localSkill.body;
		}
		const coreSkill = this.skills[`core.${id}`];
		if (coreSkill) {
			return coreSkill.body;
		}
		return null;
	}
}
