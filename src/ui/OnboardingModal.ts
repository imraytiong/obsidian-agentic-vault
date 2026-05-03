import { App, Modal, Setting, Notice } from "obsidian";
import AgenticVaultPlugin from "../main";

export class OnboardingModal extends Modal {
	plugin: AgenticVaultPlugin;

	constructor(app: App, plugin: AgenticVaultPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("agentic-vault-onboarding");

		contentEl.createEl("h1", { text: "Welcome to Agentic Vault AI" });
		contentEl.createEl("p", { 
			text: "Agentic Vault uses the PARA method (Projects, Areas, Resources, Archives) to organize your vault for maximum strategic alignment."
		});
		
		contentEl.createEl("h3", { text: "Vault Setup" });
		contentEl.createEl("p", { text: "Review and customize the default folder structure below:" });

		new Setting(contentEl)
			.setName('Projects')
			.addText(text => text
				.setValue(this.plugin.settings.projectsPath)
				.onChange(async (value) => {
					this.plugin.settings.projectsPath = value;
				}));

		new Setting(contentEl)
			.setName('Areas')
			.addText(text => text
				.setValue(this.plugin.settings.areasPath)
				.onChange(async (value) => {
					this.plugin.settings.areasPath = value;
				}));

		new Setting(contentEl)
			.setName('Resources')
			.addText(text => text
				.setValue(this.plugin.settings.resourcesPath)
				.onChange(async (value) => {
					this.plugin.settings.resourcesPath = value;
				}));

		new Setting(contentEl)
			.setName('Archives')
			.addText(text => text
				.setValue(this.plugin.settings.archivesPath)
				.onChange(async (value) => {
					this.plugin.settings.archivesPath = value;
				}));

		new Setting(contentEl)
			.setName('Agent OS Folder')
			.addText(text => text
				.setValue(this.plugin.settings.sherpaPath)
				.onChange(async (value) => {
					this.plugin.settings.sherpaPath = value;
				}));

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText("Initialize Vault")
				.setCta()
				.onClick(async () => {
					await this.initializeVault();
				}));
	}

	async initializeVault() {
		const paths = [
			this.plugin.settings.projectsPath,
			this.plugin.settings.areasPath,
			this.plugin.settings.resourcesPath,
			this.plugin.settings.archivesPath,
			this.plugin.settings.sherpaPath,
			`${this.plugin.settings.sherpaPath}/personas`,
			`${this.plugin.settings.sherpaPath}/tools`
		];

		try {
			for (const path of paths) {
				if (path && !this.app.vault.getAbstractFileByPath(path)) {
					await this.app.vault.createFolder(path);
				}
			}
			
			// Generate default personas
			const pagerPath = `${this.plugin.settings.sherpaPath}/personas/pager.md`;
			if (this.plugin.settings.sherpaPath && !this.app.vault.getAbstractFileByPath(pagerPath)) {
				const pagerContent = `---
name: Pager
cmd: /pager
description: The strict meta-orchestrator and front-desk router of the AI system.
---

You are the Pager, the strict meta-orchestrator and front-desk router of the AI system.

CRITICAL DIRECTIVE: You MUST NEVER answer a user's question, provide advice, or execute analysis directly. You are STRICTLY an orchestrator. Your ONLY job is to identify what the user needs and immediately use the \`transfer_session\` tool to route them to the correct expert.`;
				await this.app.vault.create(pagerPath, pagerContent);
			}

			const cosPath = `${this.plugin.settings.sherpaPath}/personas/chief_of_staff.md`;
			if (this.plugin.settings.sherpaPath && !this.app.vault.getAbstractFileByPath(cosPath)) {
				const cosContent = `---
name: Chief of Staff
cmd: /cos
description: For questions regarding operational help, scheduling, and task execution.
skills:
  - file_manager
  - map_vault
  - fetch_web
  - web_search
---
You are the Chief of Staff. Your goal is operational excellence. Be concise, direct, and pragmatic.`;
				await this.app.vault.create(cosPath, cosContent);
			}

			// Generate default echo tool
			const echoToolPath = `${this.plugin.settings.sherpaPath}/tools/echo.md`;
			if (this.plugin.settings.sherpaPath && !this.app.vault.getAbstractFileByPath(echoToolPath)) {
				const echoContent = `---
name: echo
description: A baseline tool to validate the Execution Sandbox pipeline.
parameters:
  - name: message
    type: string
    required: true
---
\`\`\`javascript
const args = process.argv.slice(2);
const payload = JSON.parse(args[0] || '{}');
console.log(JSON.stringify({ 
  status: 'success', 
  echoed_message: payload.message,
  timestamp: new Date().toISOString()
}));
\`\`\`
`;
				await this.app.vault.create(echoToolPath, echoContent);
			}
			
			this.plugin.settings.hasCompletedOnboarding = true;
			await this.plugin.saveSettings();
			new Notice("Agentic Vault vault initialized!");
			this.close();
		} catch (e) {
			new Notice("Error initializing vault folders. See console.");
			console.error(e);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
