export class App {
	vault: unknown = {
		adapter: {
			exists: async () => false,
			write: async () => {},
			read: async () => '',
			mkdir: async () => {},
			getBasePath: () => '/sandbox-root'
		},
		getAbstractFileByPath: () => null,
		create: async () => {},
		createFolder: async () => {},
		read: async () => '',
		modify: async () => {},
		copy: async (sourceFile: unknown, destPath: string) => {
			const fs = require('fs');
			const path = require('path');
			const vaultRoot = path.resolve(__dirname, '../../../test-vault-headless');
			const fullSrc = path.join(vaultRoot, sourceFile.path);
			const fullDest = path.join(vaultRoot, destPath);
			fs.mkdirSync(path.dirname(fullDest), { recursive: true });
			fs.copyFileSync(fullSrc, fullDest);
		}
	};
	workspace: unknown = {
		on: () => {},
		getLeavesOfType: () => [],
		getRightLeaf: () => null,
		onLayoutReady: (cb: unknown) => cb()
	};
	metadataCache: unknown = {
		on: () => {},
		getFileCache: () => ({ frontmatter: {} })
	};
	fileManager: unknown = {
		renameFile: async () => {}
	};
}

export class Notice {
	constructor(msg: string, timeout?: number) {
		console.log(`[OBSIDIAN MOCK NOTICE]: ${msg}`);
	}
}

export class TFile {
	path: string = '';
	basename: string = '';
	extension: string = '';
	stat: unknown = { mtime: Date.now(), ctime: Date.now(), size: 0 };
}

export class TFolder {
	path: string = '';
	name: string = '';
	children: unknown[] = [];
	isRoot: () => boolean = () => false;
}

import * as yaml from 'yaml';

export function parseYaml(text: string): unknown {
	try {
		return yaml.parse(text) || {};
	} catch(e) {
		return {};
	}
}

export function normalizePath(path: string): string {
	return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export class Plugin {
	app: App = new App();
	manifest: unknown = { version: '0.0.1' };
	registerEvent() {}
	registerView() {}
	addSettingTab() {}
	addRibbonIcon() {}
	addCommand() {}
	async loadData() { return {}; }
	async saveData() {}
}

export class ItemView {
	constructor(leaf: unknown) {}
}

export class PluginSettingTab {
	constructor(app: App, plugin: Plugin) {}
}

export class Setting {
	constructor(containerEl: unknown) {}
	setName() { return this; }
	setDesc() { return this; }
	addText() { return this; }
	addToggle() { return this; }
	addTextArea() { return this; }
}

export async function requestUrl(options: unknown) {
	const res = await fetch(options.url, {
		method: options.method || 'GET',
		headers: options.headers,
		body: options.body
	});
	return {
		status: res.status,
		json: await res.json().catch(() => ({})),
		text: await res.text().catch(() => '')
	};
}

export function debounce(callback: (...args: unknown[]) => void, delay: number) {
	let timeoutId: unknown;
	return (...args: unknown[]) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => callback(...args), delay);
	};
}
