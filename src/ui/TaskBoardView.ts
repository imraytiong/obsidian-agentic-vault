import { ItemView, WorkspaceLeaf } from 'obsidian';
import AgenticVaultPlugin from '../main';

export const VIEW_TYPE_AGENTIC_KANBAN = 'agentic-kanban-view';

export class TaskBoardView extends ItemView {
	plugin: AgenticVaultPlugin;
	boardContainerEl: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: AgenticVaultPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_AGENTIC_KANBAN;
	}

	getDisplayText(): string {
		return 'Agentic Control Center';
	}

	getIcon(): string {
		return 'layout-dashboard';
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('agentic-kanban-container');

		const header = contentEl.createEl('h2', { text: 'Routine Kanban Board' });
		header.setCssStyles({ textAlign: 'center', marginBottom: '20px' });
		
		this.boardContainerEl = contentEl.createDiv({ cls: 'kanban-board' });
		
		this.boardContainerEl.setCssStyles({
			display: 'flex',
			gap: '1rem',
			overflowX: 'auto',
			height: 'calc(100% - 60px)',
			padding: '10px'
		});

		// Bind render to state change
		this.plugin.routineManager.onStateChanged = () => this.renderBoard();
		this.renderBoard();
	}

	async onClose() {
		this.plugin.routineManager.onStateChanged = undefined;
	}

	renderBoard() {
		this.boardContainerEl.empty();
		
		const routines = this.plugin.routineManager.getRoutines();
		const states = this.plugin.routineManager.getQueueState();

		const columns = [
			{ id: 'idle', title: 'Idle / Scheduled' },
			{ id: 'running', title: 'Running' },
			{ id: 'completed', title: 'Completed' },
			{ id: 'failed', title: 'Failed' }
		];

		for (const col of columns) {
			const colEl = this.boardContainerEl.createDiv({ cls: 'kanban-column' });
			colEl.setCssStyles({
				flex: '1',
				minWidth: '250px',
				backgroundColor: 'var(--background-secondary)',
				borderRadius: '8px',
				padding: '15px',
				display: 'flex',
				flexDirection: 'column',
				gap: '15px',
				overflowY: 'auto'
			});

			const titleEl = colEl.createEl('h4', { text: col.title });
			titleEl.setCssStyles({ marginTop: '0', marginBottom: '5px', color: 'var(--text-muted)' });

			const colRoutines = routines.filter(r => {
				const state = states[r.id] || { status: 'idle' };
				return state.status === col.id;
			});

			for (const r of colRoutines) {
				const state = states[r.id];
				const cardEl = colEl.createDiv({ cls: 'kanban-card' });
				cardEl.setCssStyles({
					backgroundColor: 'var(--background-primary)',
					border: '1px solid var(--background-modifier-border)',
					borderRadius: '6px',
					padding: '15px',
					boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
				});

				cardEl.createEl('h5', { text: r.name, cls: 'kanban-card-title' }).setCssStyles({ margin: '0 0 10px 0', color: 'var(--text-normal)' });
				cardEl.createEl('div', { text: `Agent: ${r.agent}`, cls: 'kanban-card-meta' }).setCssStyles({ fontSize: '0.85em', color: 'var(--text-muted)', marginBottom: '3px' });
				cardEl.createEl('div', { text: `Skill: ${r.skill}`, cls: 'kanban-card-meta' }).setCssStyles({ fontSize: '0.85em', color: 'var(--text-muted)', marginBottom: '3px' });
				cardEl.createEl('div', { text: `Trigger: ${r.trigger}`, cls: 'kanban-card-meta' }).setCssStyles({ fontSize: '0.85em', color: 'var(--text-muted)' });
				
				if (state?.lastRunTime) {
					const time = new Date(state.lastRunTime).toLocaleTimeString();
					cardEl.createEl('div', { text: `Last Run: ${time}`, cls: 'kanban-card-meta' }).setCssStyles({ fontSize: '0.85em', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px solid var(--background-modifier-border)', paddingTop: '5px' });
				}

				if (state?.status === 'failed' && state.lastError) {
					cardEl.createEl('div', { text: `Error: ${state.lastError}`, cls: 'kanban-card-error' }).setCssStyles({ fontSize: '0.85em', color: 'var(--text-error)', marginTop: '8px', wordBreak: 'break-word', borderTop: '1px solid var(--background-modifier-border)', paddingTop: '5px' });
				}
			}
		}
	}
}
