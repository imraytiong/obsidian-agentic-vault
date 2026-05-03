import { App, requestUrl } from 'obsidian';
import { FleetBlueprint, FleetItem } from './types';

export class BlueprintEngine {
	app: App;

	constructor(app: App) {
		this.app = app;
	}

	async installFleet(blueprint: FleetBlueprint, rootPath: string) {
		// Ensure base directories exist
		const dirs = [
			`${rootPath}`,
			`${rootPath}/personas`,
			`${rootPath}/tools`,
			`${rootPath}/skills`
		];

		for (const dir of dirs) {
			const path = dir.replace(/\/+/g, '/').replace(/\/$/, '');
			if (path && !this.app.vault.getAbstractFileByPath(path)) {
				await this.app.vault.createFolder(path);
			}
		}

		await this.processItems(blueprint.personas, `${rootPath}/personas`);
		await this.processItems(blueprint.tools, `${rootPath}/tools`);
		await this.processItems(blueprint.skills, `${rootPath}/skills`);
	}

	private async processItems(items: FleetItem[], targetDir: string) {
		for (const item of items) {
			const fullPath = `${targetDir}/${item.filename}`.replace(/\/+/g, '/');
			
			// Skip if file already exists so we don't overwrite user modifications
			if (this.app.vault.getAbstractFileByPath(fullPath)) {
				continue;
			}

			let contentToWrite = '';

			if (item.content) {
				contentToWrite = item.content;
			} else if (item.downloadUrl) {
				try {
					const response = await requestUrl({ url: item.downloadUrl });
					contentToWrite = response.text;
				} catch (err) {
					console.error(`Failed to download fleet item: ${item.filename}`, err);
					continue; // skip creating the file
				}
			}

			if (contentToWrite) {
				// If writing into a subdirectory (e.g. skills/audit_legacy_vault/SKILL.md), ensure parent exists
				const parts = fullPath.split('/');
				parts.pop();
				const parentDir = parts.join('/');
				if (parentDir && !this.app.vault.getAbstractFileByPath(parentDir)) {
					await this.app.vault.createFolder(parentDir);
				}

				await this.app.vault.create(fullPath, contentToWrite);
			}
		}
	}
}
