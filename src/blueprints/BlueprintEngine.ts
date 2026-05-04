import { App, requestUrl, TFile } from 'obsidian';
import { FleetBlueprint, FleetItem } from './types';
import type AgenticVaultPlugin from '../main';
import { GeminiProvider } from '../llm/GeminiProvider';
import { OpenAIProvider } from '../llm/OpenAIProvider';

export class BlueprintEngine {
	app: App;
	plugin: AgenticVaultPlugin;

	constructor(app: App, plugin: AgenticVaultPlugin) {
		this.app = app;
		this.plugin = plugin;
	}

	async installFleet(blueprint: FleetBlueprint, rootPath: string, resolutions: Record<string, 'overwrite' | 'keep' | 'merge'> = {}) {
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

		await this.processItems(blueprint.personas, `${rootPath}/personas`, resolutions);
		await this.processItems(blueprint.tools, `${rootPath}/tools`, resolutions);
		await this.processItems(blueprint.skills, `${rootPath}/skills`, resolutions);
	}

	private async processItems(items: FleetItem[], targetDir: string, resolutions: Record<string, 'overwrite' | 'keep' | 'merge'>) {
		for (const item of items) {
			const fullPath = `${targetDir}/${item.filename}`.replace(/\/+/g, '/');
			const existingFile = this.app.vault.getAbstractFileByPath(fullPath);
			const resolution = resolutions[fullPath] || (existingFile ? 'keep' : 'overwrite');
			
			if (existingFile && resolution === 'keep') {
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
				const parts = fullPath.split('/');
				parts.pop();
				const parentDir = parts.join('/');
				if (parentDir && !this.app.vault.getAbstractFileByPath(parentDir)) {
					await this.app.vault.createFolder(parentDir);
				}

				if (existingFile) {
					if (resolution === 'merge') {
						const localContent = await this.app.vault.read(existingFile as TFile);
						contentToWrite = await this.performAiMerge(localContent, contentToWrite, fullPath);
					}
					// @ts-ignore
					await this.app.vault.modify(existingFile, contentToWrite);
				} else {
					if (resolution !== 'keep') {
						await this.app.vault.create(fullPath, contentToWrite);
					}
				}
			}
		}
	}

	private async performAiMerge(localContent: string, bundleContent: string, path: string): Promise<string> {
		const provider = this.plugin.settings.llmProvider === 'openai' ? 
			new OpenAIProvider(this.plugin.settings.llmApiKey, this.plugin.settings.llmModel, this.plugin.settings.llmBaseUrl) :
			new GeminiProvider(this.plugin.settings.llmApiKey, this.plugin.settings.llmModel);

		const prompt = `You are an expert code and markdown merger. Your task is to intelligently blend two versions of a file located at "${path}".

### Local Version (User's custom modifications)
\`\`\`
${localContent}
\`\`\`

### Bundled Version (New updates/bug fixes from the core system)
\`\`\`
${bundleContent}
\`\`\`

INSTRUCTIONS:
1. Retain the user's custom additions (like memory facts, custom parameters, or structural tweaks).
2. Integrate the new bug fixes or structural updates from the Bundled Version.
3. Output ONLY the raw merged file content. Do not output markdown code blocks wrapping the content unless the file itself naturally contains them. Do not output any explanation.
`;
		try {
			const res = await provider.generateResponse([{ role: 'user', content: prompt }], []);
			let finalContent = res.content || bundleContent;
			// Strip wrapping markdown blocks if LLM added them
			if (finalContent.startsWith('\`\`\`') && finalContent.endsWith('\`\`\`')) {
				const lines = finalContent.split('\n');
				if (lines.length >= 2) {
					lines.shift();
					lines.pop();
					finalContent = lines.join('\n');
				}
			}
			return finalContent;
		} catch (e) {
			console.error("AI Merge Failed", e);
			return bundleContent;
		}
	}
}
