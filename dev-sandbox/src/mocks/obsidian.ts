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
		modify: async () => {}
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

export function parseYaml(text: string): any {
	try {
		if (text.includes('required_zones:')) {
			const zones: any[] = [];
			const lines = text.split('\n');
			let currentZone: any = null;
			for (const line of lines) {
				if (line.trim().startsWith('- zone_id:')) {
					if (currentZone) zones.push(currentZone);
					currentZone = { zone_id: line.split('zone_id:')[1].trim().replace(/['"]/g, '') };
				} else if (currentZone && line.trim().startsWith('description:')) {
					currentZone.description = line.split('description:')[1].trim().replace(/['"]/g, '');
				} else if (currentZone && line.trim().startsWith('vault_path:')) {
					currentZone.vault_path = line.split('vault_path:')[1].trim().replace(/['"]/g, '');
				}
			}
			if (currentZone) zones.push(currentZone);
			
			return { required_zones: zones };
		}
		
		const lines = text.split('\n');
		const result: any = {};
		for (const line of lines) {
			const [k, ...v] = line.split(':');
			if (k && v.length) result[k.trim()] = v.join(':').trim();
		}
		return result;
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
