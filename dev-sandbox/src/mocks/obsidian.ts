export class App {
	vault: any = {
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
		copy: async (sourceFile: any, destPath: string) => {
			const fs = require('fs');
			const path = require('path');
			const vaultRoot = path.resolve(__dirname, '../../../test-vault-headless');
			const fullSrc = path.join(vaultRoot, sourceFile.path);
			const fullDest = path.join(vaultRoot, destPath);
			fs.mkdirSync(path.dirname(fullDest), { recursive: true });
			fs.copyFileSync(fullSrc, fullDest);
		}
	};
	workspace: any = {
		on: () => {},
		getLeavesOfType: () => [],
		getRightLeaf: () => null,
		onLayoutReady: (cb: any) => cb()
	};
	metadataCache: any = {
		on: () => {},
		getFileCache: () => ({ frontmatter: {} })
	};
	fileManager: any = {
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
	stat: any = { mtime: Date.now(), ctime: Date.now(), size: 0 };
}

export class TFolder {
	path: string = '';
	name: string = '';
	children: any[] = [];
	isRoot: () => boolean = () => false;
}

import * as yaml from 'yaml';

export function parseYaml(text: string): any {
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
	manifest: any = { version: '0.0.1' };
	registerEvent() {}
	registerView() {}
	addSettingTab() {}
	addRibbonIcon() {}
	addCommand() {}
	async loadData() { return {}; }
	async saveData() {}
}

export class ItemView {
	constructor(leaf: any) {}
}

export class PluginSettingTab {
	constructor(app: App, plugin: Plugin) {}
}

export class Setting {
	constructor(containerEl: any) {}
	setName() { return this; }
	setDesc() { return this; }
	addText() { return this; }
	addToggle() { return this; }
	addTextArea() { return this; }
}

export async function requestUrl(options: any) {
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

export function debounce(callback: (...args: any[]) => void, delay: number) {
	let timeoutId: any;
	return (...args: any[]) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => callback(...args), delay);
	};
}
