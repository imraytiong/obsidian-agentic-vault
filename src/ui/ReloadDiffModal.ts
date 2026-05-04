import { App, Modal, Setting } from 'obsidian';
import type AgenticVaultPlugin from '../main';

export type DiffResolution = 'overwrite' | 'keep' | 'merge';

export class ReloadDiffModal extends Modal {
	plugin: AgenticVaultPlugin;
	diffs: { path: string, type: 'modified' | 'missing' }[];
	resolutions: Record<string, DiffResolution> = {};
	onConfirm: (resolutions: Record<string, DiffResolution>) => void;

	constructor(app: App, plugin: AgenticVaultPlugin, diffs: { path: string, type: 'modified' | 'missing' }[], onConfirm: (res: Record<string, DiffResolution>) => void) {
		super(app);
		this.plugin = plugin;
		this.diffs = diffs;
		this.onConfirm = onConfirm;
		
		for (const d of diffs) {
			this.resolutions[d.path] = d.type === 'missing' ? 'overwrite' : 'keep'; // Default to safe options
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Reload Bundled Fleets' });
		
		if (this.diffs.length === 0) {
			contentEl.createEl('p', { text: 'All bundled fleets are already up to date.' });
			new Setting(contentEl)
				.addButton(btn => btn.setButtonText("Force Reload Anyway").onClick(() => {
					this.close();
					this.onConfirm({});
				}));
			return;
		}

		contentEl.createEl('p', { text: 'The following bundled files differ from your vault. Select how you want to handle each conflict:' });

		const listContainer = contentEl.createDiv();
		listContainer.setCssStyles({ maxHeight: '350px', overflowY: 'auto', backgroundColor: 'var(--background-secondary)', padding: '10px 20px', borderRadius: '5px', marginBottom: '15px' });

		for (const diff of this.diffs) {
			const itemDiv = listContainer.createDiv();
			itemDiv.setCssStyles({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--background-modifier-border)', padding: '8px 0' });
			
			const labelDiv = itemDiv.createDiv();
			labelDiv.createSpan({ text: diff.type === 'modified' ? '⚠️ ' : '➕ ' });
			labelDiv.createSpan({ text: diff.path }).style.fontWeight = 'bold';

			const selectEl = itemDiv.createEl('select');
			selectEl.value = this.resolutions[diff.path];
			selectEl.onchange = (e) => {
				this.resolutions[diff.path] = (e.target as HTMLSelectElement).value as DiffResolution;
			};

			if (diff.type === 'missing') {
				selectEl.createEl('option', { value: 'overwrite', text: 'Create File' });
				selectEl.createEl('option', { value: 'keep', text: 'Skip' });
			} else {
				selectEl.createEl('option', { value: 'keep', text: 'Keep Local' });
				selectEl.createEl('option', { value: 'overwrite', text: 'Overwrite' });
				selectEl.createEl('option', { value: 'merge', text: '✨ AI Merge' });
			}
		}

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText("Cancel")
				.onClick(() => this.close())
			)
			.addButton(btn => btn
				.setButtonText("Confirm & Reload")
				.setCta()
				.onClick(() => {
					this.close();
					this.onConfirm(this.resolutions);
				}));
	}

	onClose() {
		this.contentEl.empty();
	}
}
