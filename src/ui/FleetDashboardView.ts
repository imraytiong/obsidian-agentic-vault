import { ItemView, WorkspaceLeaf, Notice, ButtonComponent } from 'obsidian';
import type AgenticVaultPlugin from '../main';

export const VIEW_TYPE_FLEET_DASHBOARD = "fleet-dashboard-view";

export class FleetDashboardView extends ItemView {
	plugin: AgenticVaultPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: AgenticVaultPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	onload() {
		super.onload();
		
		let debounceTimer: ReturnType<typeof setTimeout>;
		this.registerEvent(
			this.plugin.app.vault.on('modify', (file) => {
				const rootFolder = this.plugin.settings.rootFolder ? `${this.plugin.settings.rootFolder}/` : '';
				const vaultPath = `${rootFolder}${this.plugin.settings.agenticVaultPath}`;
				if (file.path === `${vaultPath}/logs/routine_queue.json` || 
					file.path === `${vaultPath}/logs/approval_queue.json` ||
					file.path.startsWith(`${vaultPath}/routines/`)) {
					
					clearTimeout(debounceTimer);
					debounceTimer = setTimeout(() => {
						this.onOpen();
					}, 200);
				}
			})
		);
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
		const container = this.contentEl;
		container.empty();
		
		try {
			const root = container.createDiv('fleet-dashboard');
			
			const headerWrapper = root.createDiv({ cls: 'dashboard-header-wrapper' });
			headerWrapper.style.display = 'flex';
			headerWrapper.style.justifyContent = 'space-between';
			headerWrapper.style.alignItems = 'center';
			
			headerWrapper.createEl("h2", { text: "Agentic Fleet Operations", cls: 'dashboard-title' });
			
			const debugBtn = new ButtonComponent(headerWrapper)
				.setButtonText("🐞 Debug Dump")
				.onClick(async () => {
					try {
						const safeSettings = { ...this.plugin.settings };
						safeSettings.llmApiKey = 'HIDDEN';
						const dump = {
							timestamp: new Date().toISOString(),
							routinesCount: Object.keys(this.plugin.routineManager.getRoutines()).length,
							queueCount: this.plugin.routineManager.getTasks().length,
							approvalsCount: this.plugin.approvalQueue.getPendingRequests().length,
							settings: safeSettings,
							errorLog: this._lastError || null
						};
						
						const timestamp = new Date().getTime();
						const debugDirPath = `${this.plugin.settings.rootFolder ? this.plugin.settings.rootFolder + '/' : ''}${this.plugin.settings.agenticVaultPath}/logs/debug`.replace(/\/+/g, '/');
						
						if (!this.plugin.app.vault.getAbstractFileByPath(debugDirPath)) {
							await this.plugin.app.vault.createFolder(debugDirPath);
						}
						
						const filename = `dashboard_dump_${timestamp}.json`;
						const filepath = `${debugDirPath}/${filename}`;
						await this.plugin.app.vault.create(filepath, JSON.stringify(dump, null, 2));
						
						await navigator.clipboard.writeText(`Dashboard debug dump saved to: ${filepath}`);
						debugBtn.setButtonText("✅ Dumped!");
						setTimeout(() => debugBtn.setButtonText("🐞 Debug Dump"), 2000);
					} catch (e) {
						console.error(e);
						debugBtn.setButtonText("❌ Error");
					}
				});

			// Configured Routines Section
			const routinesSection = root.createDiv('dashboard-section');
			routinesSection.createEl("h3", { text: "Configured Routines" });
			
			const routines = this.plugin.routineManager.getRoutines();
			if (!routines || routines.length === 0) {
				routinesSection.createEl("p", { text: "No routines found. Create markdown files in the routines folder." });
			} else {
				const routinesList = routinesSection.createDiv('routines-list');
				for (const routine of routines) {
					const card = routinesList.createDiv('routine-card');
					card.style.borderLeft = `4px solid ${routine.status === 'active' ? 'var(--color-green)' : 'var(--color-red)'}`;
					
					const headerDiv = card.createDiv('routine-card-header');
					const titleSpan = headerDiv.createEl("h4", { text: routine.name || routine.id });
					
					const actionDiv = headerDiv.createDiv({ style: 'display: flex; gap: 8px;' });

					const runBtn = new ButtonComponent(actionDiv)
						.setButtonText("▶️ Run Now")
						.onClick(async () => {
							runBtn.setDisabled(true);
							runBtn.setButtonText("Running...");
							new Notice(`Triggering manual run for ${routine.name}`);
							await this.plugin.triggerParser.executeRoutine(routine, "Manually triggered from dashboard");
							this.onOpen();
						});
					runBtn.buttonEl.style.backgroundColor = 'var(--interactive-accent)';
					runBtn.buttonEl.style.color = 'var(--text-on-accent)';

					
					const toggleBtn = new ButtonComponent(actionDiv)
						.setButtonText(routine.status === 'active' ? "Deactivate" : "Activate")
						.onClick(async () => {
							toggleBtn.setDisabled(true);
							toggleBtn.setButtonText("Updating...");
							await this.plugin.routineManager.toggleRoutineStatus(routine.id);
							new Notice(`Routine ${routine.name} is now ${this.plugin.routineManager.getRoutines().find(r => r.id === routine.id)?.status}`);
							this.onOpen(); // Force UI refresh
						});
						
					if (routine.status !== 'active') {
						toggleBtn.buttonEl.addClass('is-inactive');
					}
					
					const detailsDiv = card.createDiv('routine-details');
					
					const triggerRow = detailsDiv.createDiv('routine-field-row');
					triggerRow.createEl("label", { text: "Trigger:", cls: 'routine-label' });
					
					let currentTriggerType = 'custom';
					let cronExpression = '';
					let dailyTime = '09:00';
					
					if (routine.trigger.startsWith('event(')) {
						currentTriggerType = routine.trigger;
					} else if (routine.trigger.startsWith('cron(')) {
						cronExpression = routine.trigger.substring(5, routine.trigger.length - 1);
						const dailyMatch = cronExpression.match(/^(\d+)\s+(\d+)\s+\*\s+\*\s+\*$/);
						
						if (cronExpression === '* * * * *') currentTriggerType = 'minute';
						else if (cronExpression === '0 * * * *') currentTriggerType = 'hourly';
						else if (dailyMatch) {
							currentTriggerType = 'daily';
							dailyTime = `${dailyMatch[2].padStart(2, '0')}:${dailyMatch[1].padStart(2, '0')}`;
						} else {
							currentTriggerType = 'custom';
						}
					}
					
					const triggerContainer = triggerRow.createDiv({ cls: 'trigger-container' });
					
					const typeSelect = triggerContainer.createEl("select", { cls: 'routine-select' });
					typeSelect.style.width = "auto";
					typeSelect.createEl("option", { text: "Every Minute", value: "minute" });
					typeSelect.createEl("option", { text: "Hourly", value: "hourly" });
					typeSelect.createEl("option", { text: "Daily", value: "daily" });
					typeSelect.createEl("option", { text: "Custom Cron", value: "custom" });
					typeSelect.createEl("option", { text: "On File Open", value: "event(file-open)" });
					typeSelect.value = currentTriggerType;

					const extraInputDiv = triggerContainer.createSpan();
					extraInputDiv.style.marginLeft = "5px";
					
					const updateTrigger = async (newVal: string) => {
						typeSelect.disabled = true;
						await this.plugin.routineManager.updateRoutineField(routine.id, 'trigger', newVal);
					};

					const renderExtraInput = () => {
						extraInputDiv.empty();
						if (typeSelect.value === 'daily') {
							const timeInput = extraInputDiv.createEl("input", { type: "time", value: dailyTime, cls: 'routine-input' });
							timeInput.style.width = "100px";
							timeInput.onchange = () => {
								const parts = timeInput.value.split(':');
								if (parts.length === 2) {
									updateTrigger(`cron(${parseInt(parts[1])} ${parseInt(parts[0])} * * *)`);
								}
							};
						} else if (typeSelect.value === 'custom') {
							const textInput = extraInputDiv.createEl("input", { type: "text", value: cronExpression, cls: 'routine-input' });
							textInput.style.width = "120px";
							textInput.placeholder = "* * * * *";
							textInput.onchange = () => updateTrigger(`cron(${textInput.value})`);
						}
					};

					renderExtraInput();

					typeSelect.onchange = () => {
						if (typeSelect.value === 'minute') updateTrigger('cron(* * * * *)');
						else if (typeSelect.value === 'hourly') updateTrigger('cron(0 * * * *)');
						else if (typeSelect.value === 'event(file-open)') updateTrigger('event(file-open)');
						else if (typeSelect.value === 'daily') {
							renderExtraInput();
							updateTrigger('cron(0 9 * * *)'); // Default 9 AM
						} else {
							renderExtraInput();
						}
					};

					const agentRow = detailsDiv.createDiv('routine-field-row');
					agentRow.createEl("label", { text: "Agent:", cls: 'routine-label' });
					const agentSelect = agentRow.createEl("select", { cls: 'routine-select' });
					const personas = this.plugin.personaEngine.getAllPersonas();
					for (const p of personas) {
						const opt = agentSelect.createEl("option", { text: p.name, value: p.name });
						if (p.name === routine.agent) opt.selected = true;
					}
					agentSelect.onchange = async () => {
						agentSelect.disabled = true;
						await this.plugin.routineManager.updateRoutineField(routine.id, 'agent', agentSelect.value);
					};

					const skillRow = detailsDiv.createDiv('routine-field-row');
					skillRow.createEl("label", { text: "Skill:", cls: 'routine-label' });
					const skillSelect = skillRow.createEl("select", { cls: 'routine-select' });
					const skills = this.plugin.skillsEngine.getSkillCatalog();
					
					const emptyOpt = skillSelect.createEl("option", { text: "-- None --", value: "" });
					if (!routine.skill) emptyOpt.selected = true;
					
					for (const s of skills) {
						const opt = skillSelect.createEl("option", { text: s.name, value: s.id });
						if (s.id === routine.skill || s.name === routine.skill) opt.selected = true;
					}
					skillSelect.onchange = async () => {
						skillSelect.disabled = true;
						await this.plugin.routineManager.updateRoutineField(routine.id, 'skill', skillSelect.value);
					};

					const timeoutRow = detailsDiv.createDiv('routine-field-row');
					timeoutRow.createEl("label", { text: "Timeout (mins):", cls: 'routine-label' });
					const timeoutInput = timeoutRow.createEl("input", { type: "number", value: String(routine.timeout || 5), cls: 'routine-input' });
					timeoutInput.style.maxWidth = "80px";
					timeoutInput.min = "1";
					timeoutInput.onchange = async () => {
						timeoutInput.disabled = true;
						await this.plugin.routineManager.updateRoutineField(routine.id, 'timeout', parseInt(timeoutInput.value));
					};

					const retriesRow = detailsDiv.createDiv('routine-field-row');
					retriesRow.createEl("label", { text: "Retries:", cls: 'routine-label' });
					const retriesInput = retriesRow.createEl("input", { type: "number", value: String(routine.retries || 3), cls: 'routine-input' });
					retriesInput.style.maxWidth = "80px";
					retriesInput.min = "0";
					retriesInput.onchange = async () => {
						retriesInput.disabled = true;
						await this.plugin.routineManager.updateRoutineField(routine.id, 'retries', parseInt(retriesInput.value));
					};
				}
			}

			// Telemetry Section
			root.createEl("hr");
			const telemetrySection = root.createDiv('dashboard-section');
			telemetrySection.createEl("h3", { text: "Routine Telemetry" });
			
			let logs: any[] = [];
			try {
				const rootFolder = this.plugin.settings.rootFolder ? `${this.plugin.settings.rootFolder}/` : '';
				const vaultPath = `${rootFolder}${this.plugin.settings.agenticVaultPath}`;
				const telemetryPath = `${vaultPath}/logs/routine_queue.json`.replace(/\/+/g, '/');
				
				if (await this.plugin.app.vault.adapter.exists(telemetryPath)) {
					const content = await this.plugin.app.vault.adapter.read(telemetryPath);
					const data = JSON.parse(content);
					logs = Array.isArray(data) ? data.slice(-10).reverse() : [];
				}
			} catch (e) {
				console.error("Failed to read telemetry:", e);
			}

			if (logs.length === 0) {
				telemetrySection.createEl("p", { text: "No routine data recorded yet." });
			} else {
				const table = telemetrySection.createEl("table", { cls: "telemetry-table" });
				const header = table.createEl("tr");
				header.createEl("th", { text: "Task ID" });
				header.createEl("th", { text: "Routine" });
				header.createEl("th", { text: "Status" });
				header.createEl("th", { text: "Spawn Time" });

				for (const log of logs) {
					const row = table.createEl("tr");
					
					const idTd = row.createEl("td");
					idTd.createEl("small", { text: log.id || "Unknown", cls: "text-muted" });

					row.createEl("td", { text: log.routineName || "Unknown" });
					
					const statusTd = row.createEl("td");
					const statusBadge = statusTd.createSpan({ text: log.status || "pending" });
					statusBadge.style.padding = "2px 6px";
					statusBadge.style.borderRadius = "4px";
					statusBadge.style.backgroundColor = 
						log.status === 'completed' ? 'var(--color-green)' : 
						log.status === 'failed' ? 'var(--color-red)' :
						log.status === 'running' ? 'var(--color-blue)' : 'var(--color-yellow)';
					statusBadge.style.color = 'var(--text-on-accent)';
					
					if (log.status === 'running') {
						const abortBtn = statusTd.createEl('button', { text: 'Abort', cls: 'abort-btn' });
						abortBtn.onclick = async () => {
							abortBtn.disabled = true;
							abortBtn.innerText = '...';
							await this.plugin.routineManager.abortTask(log.id);
							this.onOpen();
						};
					}

					const dateStr = log.spawnTime ? new Date(log.spawnTime).toLocaleString() : "Unknown";
					row.createEl("td", { text: dateStr });
				}
			}

			// HITL moved to ChatView

			// Add styles
			const style = document.createElement('style');
			style.textContent = `
				.dashboard-section { margin-bottom: 2rem; }
				.dashboard-title { margin: 0; }
				.telemetry-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
				.telemetry-table th, .telemetry-table td { border: 1px solid var(--background-modifier-border); padding: 8px; text-align: left; }
				.telemetry-table th { background-color: var(--background-secondary); }
				.text-muted { color: var(--text-muted); font-style: italic; }
				
				.routines-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; margin-top: 10px; }
				.routine-card { border: 1px solid var(--background-modifier-border); padding: 15px; border-radius: 8px; background-color: var(--background-primary-alt); }
				.routine-card h4 { margin: 0 0 10px 0; color: var(--text-normal); }
				.routine-card p { margin: 5px 0; font-size: 0.9em; }
				.routine-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
				.is-inactive { opacity: 0.7; }
				
				.routine-details { display: flex; flex-direction: column; gap: 8px; }
				.routine-field-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.9em; }
				.routine-label { font-weight: 500; color: var(--text-muted); min-width: 60px; }
				.trigger-container { flex: 1; display: flex; align-items: center; max-width: 65%; }
				.routine-input, .routine-select { flex: 1; padding: 4px; border: 1px solid var(--background-modifier-border); border-radius: 4px; background: var(--background-primary); color: var(--text-normal); font-size: 0.9em; max-width: 100%; min-width: 0; }
				.routine-input:disabled, .routine-select:disabled { opacity: 0.5; }
			`;
			root.appendChild(style);
			this._lastError = null;
		} catch (error) {
			this._lastError = error.stack || String(error);
			container.createEl('h3', { text: '🚨 Dashboard Render Error' });
			container.createEl('pre', { text: this._lastError, cls: 'error-log' });
			
			const debugBtn = new ButtonComponent(container)
				.setButtonText("🐞 Save Debug Dump")
				.onClick(async () => {
					try {
						const timestamp = new Date().getTime();
						const debugDirPath = `${this.plugin.settings.rootFolder ? this.plugin.settings.rootFolder + '/' : ''}${this.plugin.settings.agenticVaultPath}/logs/debug`.replace(/\/+/g, '/');
						if (!this.plugin.app.vault.getAbstractFileByPath(debugDirPath)) {
							await this.plugin.app.vault.createFolder(debugDirPath);
						}
						const filepath = `${debugDirPath}/dashboard_crash_${timestamp}.json`;
						await this.plugin.app.vault.create(filepath, JSON.stringify({ error: this._lastError }, null, 2));
						await navigator.clipboard.writeText(`Crash dump saved to: ${filepath}`);
						debugBtn.setButtonText("✅ Dumped!");
					} catch (e) {
						debugBtn.setButtonText("❌ Failed");
					}
				});
		}
	}

	async onClose() {
		// Cleanup if needed
	}
}
