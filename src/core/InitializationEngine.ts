import { App, TFile, TFolder, normalizePath } from 'obsidian';
import type AgenticVaultPlugin from '../main';
import { BundledFleets } from '../blueprints/BundledFleets';

export class InitializationEngine {
	private app: App;
	private plugin: AgenticVaultPlugin;

	constructor(plugin: AgenticVaultPlugin) {
		this.plugin = plugin;
		this.app = plugin.app;
	}

	async initialize() {
		const vaultRoot = this.plugin.settings.rootFolder 
			? normalizePath(`${this.plugin.settings.rootFolder}/${this.plugin.settings.agenticVaultPath}`)
			: normalizePath(this.plugin.settings.agenticVaultPath);

		await this.ensureFolder(vaultRoot);
		await this.ensureFolder(normalizePath(`${vaultRoot}/fleets`));
		await this.ensureFolder(normalizePath(`${vaultRoot}/memory`));
		await this.ensureFolder(normalizePath(`${vaultRoot}/logs`));

		// Deploy Bundled Fleets
		for (const [fleetName, fleetObj] of Object.entries(BundledFleets)) {
			// Only deploy 'core' by default. Other fleets must be manually installed.
			if (fleetName !== 'core') continue;
			await this.deployFleet(fleetName, fleetObj);
		}
	}

	public async deployFleet(fleetName: string, fleetObj?: any) {
		if (!fleetObj) {
			fleetObj = (BundledFleets as any)[fleetName];
			if (!fleetObj) return;
		}

		const vaultRoot = this.plugin.settings.rootFolder 
			? normalizePath(`${this.plugin.settings.rootFolder}/${this.plugin.settings.agenticVaultPath}`)
			: normalizePath(this.plugin.settings.agenticVaultPath);

		const fleetDir = normalizePath(`${vaultRoot}/fleets/${fleetName}`);
		await this.ensureFolder(fleetDir);

		// Unpack subdirectories
		const categories = ['personas', 'tools', 'skills', 'routines', 'templates'];
		for (const cat of categories) {
			await this.ensureFolder(normalizePath(`${fleetDir}/${cat}`));
		}

		// Deploy Root files (like fleet.md)
		if (fleetObj.files.root) {
			for (const fileObj of fleetObj.files.root) {
				await this.deployFile(normalizePath(`${fleetDir}/${fileObj.filename}`), fileObj.content);
			}
		}

		// Deploy categorized files
		for (const cat of categories) {
			if (fleetObj.files[cat]) {
				for (const fileObj of fleetObj.files[cat]) {
					await this.deployFile(normalizePath(`${fleetDir}/${cat}/${fileObj.filename}`), fileObj.content);
				}
			}
		}
	}

	private async ensureFolder(path: string): Promise<boolean> {
		const exists = this.app.vault.getAbstractFileByPath(path);
		if (!exists) {
			try {
				await this.app.vault.createFolder(path);
				return true; // Was created
			} catch (e: any) {
				if (e.message && !e.message.includes('already exists')) {
					console.error(`Failed to create folder ${path}`, e);
				}
			}
		}
		return false; // Already existed
	}

	private async deployFile(path: string, content: string) {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file) {
			// Write immediately
			try {
				await this.app.vault.create(path, content);
			} catch (e: any) {
				if (e.message && e.message.includes('already exists')) {
					await this.app.vault.adapter.write(path, content);
				} else {
					console.warn(`Failed to deploy ${path}, file might already exist on disk.`, e);
				}
			}
		} else if (file instanceof TFile) {
			// Check versions
			const existingContent = await this.app.vault.read(file);
			const existingVersionMatch = existingContent.match(/system_version:\s*([0-9.]+)/);
			const bundledVersionMatch = content.match(/system_version:\s*([0-9.]+)/);

			if (bundledVersionMatch) {
				const bundledVer = bundledVersionMatch[1];
				if (!existingVersionMatch) {
					// User removed the version tag, meaning they took manual ownership. Do not overwrite.
					return;
				}

				const existingVer = existingVersionMatch[1];
				if (this.isNewerVersion(bundledVer, existingVer)) {
					await this.app.vault.modify(file, content);
				}
			}
		}
	}

	private isNewerVersion(bundled: string, existing: string): boolean {
		const bParts = bundled.split('.').map(Number);
		const eParts = existing.split('.').map(Number);
		for (let i = 0; i < Math.max(bParts.length, eParts.length); i++) {
			const b = bParts[i] || 0;
			const e = eParts[i] || 0;
			if (b > e) return true;
			if (b < e) return false;
		}
		return false;
	}
}
