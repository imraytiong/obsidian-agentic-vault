import type AgenticVaultPlugin from '../main';
import { LLMMessage } from '../llm/LLMProvider';

export class NativeToolHandler {
	private plugin: AgenticVaultPlugin;

	constructor(plugin: AgenticVaultPlugin) {
		this.plugin = plugin;
	}

	async handle(tc: import('../llm/LLMProvider').ToolCall, personaName: string, activeAssistantMessage: LLMMessage, history: LLMMessage[]): Promise<{ handled: boolean, haltReAct?: boolean, responseMessage?: string }> {
		if (tc.name === 'transfer_session') {
			const args = tc.arguments;
			const targetPersona = String(args.target_persona);
			const handoffMsg = String(args.handoff_context);

			const handoffNotice = `*Transferred session to **${targetPersona}**.*\n\n> ${handoffMsg}`;
			activeAssistantMessage.content += (activeAssistantMessage.content ? '\n\n' : '') + handoffNotice;
			history.push({ role: 'tool', content: `Session successfully transferred to ${targetPersona}.`, toolCallId: tc.id, toolName: tc.name });

			const targetHistory = this.plugin.chatService.getAgentHistory(targetPersona);
			
			// Strip out <details> tool logs to prevent massive token payloads and slowdowns
			const recentContext = this.plugin.chatService.unifiedTimeline.slice(-6).map(m => {
				const strippedContent = m.content.replace(/<details>[\s\S]*?<\/details>/g, '').trim();
				return strippedContent ? `[${m.persona || m.role}]: ${strippedContent}` : null;
			}).filter(Boolean).join('\n\n');

			const fullHandoffMessage = `[SYSTEM HANDOFF from ${personaName}]: ${handoffMsg}\n\n### Recent Conversation Context:\n${recentContext}\n\nPlease take over the conversation and assist the user immediately based on this context.`;
			
			targetHistory.push({ role: 'user', content: fullHandoffMessage, persona: 'System' });

			if (this.plugin.chatService.onPersonaChanged) this.plugin.chatService.onPersonaChanged(targetPersona);
			this.plugin.chatService.persistState();
			
			// Await the handoff continuation so the Pager loop blocks until Chief of Staff finishes
			this.plugin.chatService.currentStatus = `Waking up ${targetPersona}...`;
			await this.plugin.chatService.sendMessage("", targetPersona, undefined, undefined, true);
			
			return { handled: true, haltReAct: true, responseMessage: handoffNotice };
		} 

		if (tc.name === 'load_skill') {
			const args = tc.arguments;
			const skillId = String(args.skill_id);
			const executionFleet = this.plugin.personaEngine.getPersonaByName(personaName)?.fleet;
			const body = this.plugin.skillsEngine.getSkillBody(skillId, executionFleet);
			
			let toolOutputStr = body ? `[Skill Instructions Loaded: ${skillId}]\n\n${body}` : `Error: Skill '${skillId}' not found.`;

			activeAssistantMessage.content += (activeAssistantMessage.content ? '\n\n' : '') + `<details><summary>🧠 Loaded Skill: ${skillId}</summary>\n\n\`\`\`text\n${toolOutputStr}\n\`\`\`\n</details>`;
			if (this.plugin.chatService.onTimelineUpdated) this.plugin.chatService.onTimelineUpdated();

			history.push({ role: 'tool', content: toolOutputStr, toolCallId: tc.id, toolName: tc.name });
			this.plugin.chatService.persistState();
			return { handled: true, haltReAct: false }; 
		}

		if (tc.name === 'request_approval') {
			const args = tc.arguments;
			const summary = String(args.action_summary || 'Unknown Action');
			const reason = String(args.reason || 'No reason provided');
			
			const msg = `⚠️ **Approval Requested:**\n- **Action:** ${summary}\n- **Reason:** ${reason}\n\n*The system has paused and added this request to the HITL queue.*`;
			activeAssistantMessage.content += (activeAssistantMessage.content ? '\n\n' : '') + msg;
			history.push({ role: 'tool', content: "Approval requested. Loop paused until user responds.", toolCallId: tc.id, toolName: tc.name });
			
			await this.plugin.approvalQueue.addRequest({
				persona: personaName,
				summary,
				reason,
				historyPayload: JSON.parse(JSON.stringify(history)),
				timestamp: new Date().toISOString()
			});

			if (this.plugin.chatService.onTimelineUpdated) this.plugin.chatService.onTimelineUpdated();
			this.plugin.chatService.persistState();
			return { handled: true, haltReAct: true, responseMessage: msg }; 
		}

		if (tc.name === 'present_options') {
			const args = tc.arguments;
			const options = Array.isArray(args.options) ? args.options.map(String) : [];
			const type = args.selection_type === 'multiple' ? 'multiple' : 'single';
			const custom = args.allow_custom === true;

			activeAssistantMessage.uiOptions = { options, type, custom };
			
			history.push({ role: 'tool', content: "Options presented successfully. System paused waiting for user selection.", toolCallId: tc.id, toolName: tc.name });

			if (this.plugin.chatService.onTimelineUpdated) this.plugin.chatService.onTimelineUpdated();
			this.plugin.chatService.persistState();
			return { handled: true, haltReAct: true, responseMessage: "Awaiting user selection..." };
		}

		if (tc.name === 'manage_routines') {
			const args = tc.arguments;
			let toolOutputStr = '';

			if (args.action === 'list_routines') {
				const routines = this.plugin.routineManager.getRoutines();
				if (routines.length > 0) {
					toolOutputStr = routines.map(r => `- **${r.id}** (${r.name}): Triggers on ${r.trigger}, assigned to ${r.agent}, executing skill ${r.skill}`).join('\n');
				} else {
					const p = `${this.plugin.settings.rootFolder ? this.plugin.settings.rootFolder + '/' : ''}${this.plugin.settings.agenticVaultPath}/routines`.replace(/\/+/g, '/');
					const f = this.plugin.app.vault.getAbstractFileByPath(p) as { children?: unknown[] } | null;
					toolOutputStr = `No routines found. (Debug: path=${p}, exists=${!!f})`;
					if (f && f.children) {
						toolOutputStr += ` children count: ${f.children.length}`;
					}
				}
			} else if (args.action === 'view_queue') {
				const tasks = this.plugin.routineManager.getTasks().slice(-15);
				toolOutputStr = tasks.map(t => `- [${t.status.toUpperCase()}] **${t.id}** (${t.routineName}) spawned at ${new Date(t.spawnTime).toLocaleString()}`).join('\n') || 'Queue is empty.';
			} else if (args.action === 'trigger') {
				if (!args.routine_id) {
					toolOutputStr = 'Error: routine_id is required to trigger a routine.';
				} else {
					const routine = this.plugin.routineManager.getRoutines().find(r => r.id === String(args.routine_id));
					if (!routine) {
						toolOutputStr = `Error: Routine '${String(args.routine_id)}' not found.`;
					} else {
						// Spawn task manually
						void this.plugin.triggerParser.executeRoutine(routine, 'Manually triggered by ' + personaName);
						toolOutputStr = `Successfully triggered routine '${routine.id}'. It has been added to the queue and is running in the background.`;
					}
				}
			} else {
				toolOutputStr = `Error: Unknown action '${args.action}'`;
			}

			activeAssistantMessage.content += (activeAssistantMessage.content ? '\n\n' : '') + `<details><summary>⚙️ Routine Manager: ${args.action}</summary>\n\n\`\`\`text\n${toolOutputStr}\n\`\`\`\n</details>`;
			if (this.plugin.chatService.onTimelineUpdated) this.plugin.chatService.onTimelineUpdated();

			history.push({ role: 'tool', content: toolOutputStr, toolCallId: tc.id, toolName: tc.name });
			this.plugin.chatService.persistState();
			return { handled: true, haltReAct: false }; 
		}

		if (tc.name === 'toggle_background_routines') {
			const args = tc.arguments;
			const enabled = Boolean(args.enabled);
			this.plugin.settings.routinesEnabled = enabled;
			await this.plugin.saveSettings();

			const toolOutputStr = `Background routines are now ${enabled ? 'ENABLED' : 'DISABLED'}.`;
			
			activeAssistantMessage.content += (activeAssistantMessage.content ? '\n\n' : '') + `<details><summary>⚙️ Routine Toggle</summary>\n\n\`\`\`text\n${toolOutputStr}\n\`\`\`\n</details>`;
			if (this.plugin.chatService.onTimelineUpdated) this.plugin.chatService.onTimelineUpdated();

			history.push({ role: 'tool', content: toolOutputStr, toolCallId: tc.id, toolName: tc.name });
			this.plugin.chatService.persistState();
			return { handled: true, haltReAct: false }; 
		}

		return { handled: false };
	}
}
