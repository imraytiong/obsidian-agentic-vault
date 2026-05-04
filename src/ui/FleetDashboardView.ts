import { ItemView, WorkspaceLeaf, Notice, ButtonComponent } from 'obsidian';
import type AgenticVaultPlugin from '../main';

export const VIEW_TYPE_FLEET_DASHBOARD = "fleet-dashboard-view";

export class FleetDashboardView extends ItemView {
	plugin: AgenticVaultPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: AgenticVaultPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_FLEET_DASHBOARD;
	}

	getDisplayText() {
		return "Fleet Dashboard";
	}

	getIcon() {
		return "activity";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		
		const root = container.createDiv('fleet-dashboard');
		root.createEl("h2", { text: "Agentic Fleet Operations" });

		// Telemetry Section
		const telemetrySection = root.createDiv('dashboard-section');
		telemetrySection.createEl("h3", { text: "Routine Telemetry" });
		
		let logs = [];
		try {
			const rootFolder = this.plugin.settings.rootFolder ? `${this.plugin.settings.rootFolder}/` : '';
			const vaultPath = `${rootFolder}${this.plugin.settings.agenticVaultPath}`;
			const telemetryPath = `${vaultPath}/logs/routine_queue.json`;
			
			if (await this.plugin.app.vault.adapter.exists(telemetryPath)) {
				const content = await this.plugin.app.vault.adapter.read(telemetryPath);
				const data = JSON.parse(content);
				logs = Object.values(data);
			}
		} catch (e) {
			console.error("Failed to read telemetry:", e);
		}

		if (logs.length === 0) {
			telemetrySection.createEl("p", { text: "No routine data recorded yet." });
		} else {
			const table = telemetrySection.createEl("table", { cls: "telemetry-table" });
			const header = table.createEl("tr");
			header.createEl("th", { text: "Routine" });
			header.createEl("th", { text: "Status" });
			header.createEl("th", { text: "Last Run" });

			for (const log of logs) {
				const row = table.createEl("tr");
				row.createEl("td", { text: (log as any).name || "Unknown" });
				
				const statusTd = row.createEl("td");
				const statusBadge = statusTd.createSpan({ text: (log as any).status || "pending" });
				statusBadge.style.padding = "2px 6px";
				statusBadge.style.borderRadius = "4px";
				statusBadge.style.backgroundColor = (log as any).status === 'active' ? 'var(--color-green)' : 'var(--color-yellow)';
				statusBadge.style.color = 'var(--text-on-accent)';

				const dateStr = (log as any).lastRun ? new Date((log as any).lastRun).toLocaleString() : "Never";
				row.createEl("td", { text: dateStr });
			}
		}

		// Approvals Section
		root.createEl("hr");
		const approvalSection = root.createDiv('dashboard-section');
		approvalSection.createEl("h3", { text: "Pending Approvals (HITL)" });
		
		const pendingRequests = this.plugin.approvalQueue.getPendingRequests();
		
		if (pendingRequests.length === 0) {
			approvalSection.createEl("p", { text: "No pending actions require human approval at this time.", cls: "text-muted" });
		} else {
			const reqList = approvalSection.createDiv('approval-list');
			for (const req of pendingRequests) {
				const card = reqList.createDiv('approval-card');
				card.createEl("h4", { text: `[${req.persona}] requests permission:` });
				card.createEl("p", { text: req.summary, cls: "approval-summary" });
				card.createEl("p", { text: `Reason: ${req.reason}`, cls: "approval-reason" });
				card.createEl("small", { text: `Requested: ${new Date(req.timestamp).toLocaleString()}`, cls: "text-muted" });
				
				const btnContainer = card.createDiv('approval-buttons');
				
				const approveBtn = new ButtonComponent(btnContainer)
					.setButtonText("Approve & Resume")
					.setCta()
					.onClick(async () => {
						approveBtn.setDisabled(true);
						await this.plugin.approvalQueue.resolveRequest(req.id, 'approved');
						new Notice(`Approved action for ${req.persona}. Agent is resuming...`);
						await this.plugin.chatService.sendMessage("Approval GRANTED. You may proceed with the proposed action.", req.persona);
						this.onOpen(); // Refresh view
					});
					
				const rejectBtn = new ButtonComponent(btnContainer)
					.setButtonText("Reject")
					.onClick(async () => {
						rejectBtn.setDisabled(true);
						await this.plugin.approvalQueue.resolveRequest(req.id, 'rejected');
						new Notice(`Rejected action for ${req.persona}.`);
						await this.plugin.chatService.sendMessage("Approval REJECTED. Do NOT proceed. You must rethink your approach or stop the task.", req.persona);
						this.onOpen(); // Refresh view
					});
			}
		}

		// Add styles
		const style = document.createElement('style');
		style.textContent = `
			.dashboard-section { margin-bottom: 2rem; }
			.telemetry-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
			.telemetry-table th, .telemetry-table td { border: 1px solid var(--background-modifier-border); padding: 8px; text-align: left; }
			.telemetry-table th { background-color: var(--background-secondary); }
			.text-muted { color: var(--text-muted); font-style: italic; }
			.approval-list { display: flex; flex-direction: column; gap: 1rem; margin-top: 10px; }
			.approval-card { border: 1px solid var(--background-modifier-border); padding: 15px; border-radius: 8px; background-color: var(--background-primary-alt); }
			.approval-card h4 { margin-top: 0; color: var(--text-accent); }
			.approval-summary { font-weight: bold; margin-bottom: 5px; }
			.approval-reason { margin-top: 0; font-size: 0.9em; }
			.approval-buttons { display: flex; gap: 10px; margin-top: 15px; }
		`;
		root.appendChild(style);
	}

	async onClose() {
		// Cleanup if needed
	}
}
