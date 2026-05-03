import { App, TFile, TFolder } from 'obsidian';

export interface SkillDefinition {
	id: string; // The folder name
	name: string;
	description: string;
	body: string; // The contents of SKILL.md
}

export class SkillsEngine {
	private app: App;
	private sherpaPath: string;
	private skills: Record<string, SkillDefinition> = {};

	constructor(app: App, sherpaPath: string) {
		this.app = app;
		this.sherpaPath = sherpaPath;
	}

	async loadSkills() {
		this.skills = {};
		if (!this.sherpaPath) return;

		const skillsPath = `${this.sherpaPath}/skills`;
		const folder = this.app.vault.getAbstractFileByPath(skillsPath);
		
		if (!folder || !(folder instanceof TFolder)) return;

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
						
						this.skills[child.name] = {
							id: child.name,
							name: frontmatter.name,
							description: typeof frontmatter.description === 'string' ? frontmatter.description : '',
							body: body
						};
					}
				}
			}
		}
	}

	getSkillCatalog(): { id: string, name: string, description: string }[] {
		return Object.values(this.skills).map(s => ({
			id: s.id,
			name: s.name,
			description: s.description
		}));
	}

	getSkillBody(id: string): string | null {
		return this.skills[id]?.body || null;
	}
}
