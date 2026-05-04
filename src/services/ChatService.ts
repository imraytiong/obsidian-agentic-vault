import AgenticVaultPlugin from "../main";
import { LLMMessage, LLMProvider } from "../llm/LLMProvider";
import { GeminiProvider } from "../llm/GeminiProvider";
import { OpenAIProvider } from "../llm/OpenAIProvider";

export type { LLMMessage as ChatMessage } from "../llm/LLMProvider";

export class ChatService {
	plugin: AgenticVaultPlugin;
	unifiedTimeline: LLMMessage[] = [];
	agentContexts: Record<string, LLMMessage[]> = {};
	onPersonaChanged?: (newPersona: string) => void;
	onTimelineUpdated?: () => void;

	constructor(plugin: AgenticVaultPlugin) {
		this.plugin = plugin;
		if (this.plugin.settings.chatState) {
			this.unifiedTimeline = this.plugin.settings.chatState.unifiedTimeline || [];
			this.agentContexts = this.plugin.settings.chatState.agentContexts || {};
		}
	}

	async persistState() {
		this.plugin.settings.chatState = {
			unifiedTimeline: this.unifiedTimeline,
			agentContexts: this.agentContexts
		};
		await this.plugin.saveData(this.plugin.settings);
	}

	getAgentHistory(personaName: string): LLMMessage[] {
		if (!this.agentContexts[personaName]) {
			this.agentContexts[personaName] = [];
		}
		return this.agentContexts[personaName];
	}

	private getProvider(): LLMProvider {
		if (this.plugin.settings.llmProvider === 'openai') {
			return new OpenAIProvider(
				this.plugin.settings.llmApiKey,
				this.plugin.settings.llmModel,
				this.plugin.settings.llmBaseUrl
			);
		}
		return new GeminiProvider(
			this.plugin.settings.llmApiKey,
			this.plugin.settings.llmModel
		);
	}

	async sendMessage(message: string, personaName: string): Promise<string> {
		const history = this.getAgentHistory(personaName);
		
		if (message) {
			this.unifiedTimeline.push({ role: 'user', content: message, persona: personaName });
			history.push({ role: 'user', content: message, persona: personaName });
			this.plugin.logger.log('USER_MESSAGE_SUBMITTED', { text: message, persona: personaName });
			this.persistState();
		}
		
		const persona = this.plugin.personaEngine.getPersonaByName(personaName);
		let systemPrompt = persona ? persona.systemPrompt : 'You are a helpful assistant.';

		// Inject contextual metadata into the system prompt
		const now = new Date();
		systemPrompt += `\n\n[System Context]\nThe current date and time is: ${now.toLocaleString()}.`;

		// Inject Memory Context
		const sharedMemoryPath = 'AgenticVault/memory/shared_memory.md';
		if (await this.plugin.app.vault.adapter.exists(sharedMemoryPath)) {
			const sharedMemoryContent = await this.plugin.app.vault.adapter.read(sharedMemoryPath);
			systemPrompt += `\n\n[Global User Profile (Core Identity)]\n${sharedMemoryContent}`;
		}

		const personaMemoryPath = `AgenticVault/memory/personas/${personaName.toLowerCase().replace(/ /g, '_')}_memory.md`;
		if (await this.plugin.app.vault.adapter.exists(personaMemoryPath)) {
			const personaMemoryContent = await this.plugin.app.vault.adapter.read(personaMemoryPath);
			systemPrompt += `\n\n[Persona-Specific Context]\n${personaMemoryContent}`;
		}

		systemPrompt += `\n\n[System Rules]\n- When referring to files in the vault, ALWAYS use Obsidian wiki-link syntax: [[File Name]].\n- When asking the user a structured list of questions, DO NOT ask them in plain text. Instead, output a JSON block tagged with \`\`\`json-form\`\`\` that defines the form. The JSON must follow this exact schema: { "title": "Form Title", "fields": [ { "id": "field_id", "label": "Question Text", "type": "textarea", "placeholder": "Example answer..." } ] }\n- You have access to a permanent memory system via the \`update_memory\` tool. If the user explicitly states a preference, makes a major decision, or reveals a long-term goal, you MUST use the \`update_memory\` tool to permanently record it.\n- Hierarchy of Truth: The [Global User Profile (Core Identity)] block represents the user's current true identity. Vault documents represent Project State. If a Vault document contradicts the Core Identity, the Core Identity takes precedence. You MUST explicitly ask the user if the Vault document needs to be updated to match their new identity.\n- [VERIFICATION RULE]: You are strictly prohibited from confirming a task is complete based solely on your intent. You MUST receive a successful output receipt from a tool before telling the user it is done.`;

		// Dynamically inject the registry of available personas so agents can route properly
		const allPersonas = this.plugin.personaEngine.getAllPersonas();
		const personaRegistry = allPersonas.map(p => `- **${p.name}**: ${p.description || 'A helpful specialized agent.'}`).join('\n');
		systemPrompt += `\n\n[Available Expert Personas for Handoff]\n${personaRegistry}\nIf you believe another agent is better suited to help the user, use the transfer_session tool to hand them off.`;

		// Inject Skill Catalog
		const skills = this.plugin.skillsEngine.getSkillCatalog();
		if (skills.length > 0) {
			const catalog = skills.map(s => `- **${s.id}** (${s.name}): ${s.description}`).join('\n');
			systemPrompt += `\n\n[Available Skills Catalog]\n${catalog}\nUse the \`load_skill\` tool to read the full instructions for any of these skills if they are relevant to your current task.`;
		}

		this.plugin.logger.log('LLM_REQUEST_INITIATED', { message, persona: personaName, systemPrompt });
		
		const apiKey = this.plugin.settings.llmApiKey;
		if (!apiKey) {
			const err = "Error: LLM API Key is missing. Please configure it in Settings -> Agentic Vault Settings.";
			this.plugin.logger.log('LLM_ERROR', { error: err });
			return err;
		}

		// Handle explicit sandbox debug commands
		if (message.toLowerCase().startsWith('/execute')) {
			const parts = message.trim().split(' ');
			const toolName = parts[1];
			if (!toolName) return `[${personaName}] Error: Missing tool name. Usage: \`/execute <toolName> <jsonPayload>\``;
			const payloadString = parts.slice(2).join(' ');
			let payload = {};
			try { payload = JSON.parse(payloadString); } catch (e) { payload = { raw: payloadString }; }
			let response = `[${personaName}] Initiating local sandbox execution for tool: **${toolName}**...\n\n`;
			const result = await this.plugin.executionSandbox.executeTool(toolName, payload);
			if (result.success) response += `**Sandbox Output:**\n\`\`\`json\n${result.output}\n\`\`\``;
			else response += `**Sandbox Error:**\n\`\`\`text\n${result.output}\n\`\`\``;
			
			this.unifiedTimeline.push({ role: 'assistant', content: response, persona: personaName });
			history.push({ role: 'assistant', content: response, persona: personaName });
			this.persistState();
			return response;
		} 

		// Full ReAct Loop
		try {
			const provider = this.getProvider();
			const allTools = [
				...this.plugin.toolRegistry.getAllTools(),
				...this.plugin.mcpEngine.getMcpToolsAsRegistryFormat()
			];
			
			const persona = this.plugin.personaEngine.getPersonaByName(personaName);
			let tools = [];
			
			if (persona && persona.skills) {
				if (persona.skills.includes('all')) {
					tools = allTools;
				} else {
					tools = allTools.filter(t => {
						if (t.name === 'update_memory') return true;
						if (persona.skills?.includes(t.name)) return true;
						
						// If the tool is an MCP tool, allow it if the persona has the server name as a skill
						const mcpPrefixMatch = persona.skills?.some(skill => t.name.startsWith(`${skill}___`));
						return mcpPrefixMatch;
					});
				}
			} else {
				// If no skills defined, only give them the core memory tool
				tools = allTools.filter(t => t.name === 'update_memory');
			}
			
			
			// Inject Native Tool for Handoff
			tools.push({
				name: 'transfer_session',
				description: 'Transfer the user to a different persona/agent. Use this when the user needs help from a specific expert. CRITICAL: The target agent CANNOT see the conversation history. You MUST include all relevant requirements, code, and context explicitly in the handoff_context.',
				language: 'native',
				scriptContent: '',
				parameters: [
					{ name: 'target_persona', type: 'string', description: 'The exact name of the persona to transfer to.', required: true },
					{ name: 'handoff_context', type: 'string', description: 'A highly detailed summary of the conversation, all requirements, and exactly what the target agent needs to do.', required: true }
				]
			});

			// Inject Native Tool for Loading Skills
			tools.push({
				name: 'load_skill',
				description: 'Load the full Standard Operating Procedure (SOP) instructions for a specific skill. You MUST do this before attempting to execute a skill.',
				language: 'native',
				scriptContent: '',
				parameters: [
					{ name: 'skill_id', type: 'string', description: 'The exact ID (folder name) of the skill to load.', required: true }
				]
			});

			// Inject Native Tool for HITL
			tools.push({
				name: 'request_approval',
				description: 'Request human approval before performing a high-stakes or destructive action. The system will pause and wait for the user to approve or reject the request.',
				language: 'native',
				scriptContent: '',
				parameters: [
					{ name: 'action_summary', type: 'string', description: 'A short summary of what you are about to do.', required: true },
					{ name: 'reason', type: 'string', description: 'Why you are requesting approval for this action.', required: true }
				]
			});
			
			// Build payload with system prompt
			const payload: LLMMessage[] = [
				{ role: 'system', content: systemPrompt },
				...history
			];

			let llmResponse = await provider.generateResponse(payload, tools);
			this.plugin.logger.log('LLM_RAW_RESPONSE', llmResponse);

			// Handle Tool Calling Loop
			let iterations = 0;
			const maxIterations = 15;
			const toolCallHistory: Record<string, number> = {};

			// Create a single active assistant message for the UI timeline
			const activeAssistantMessage: unknown = { role: 'assistant', content: '', persona: personaName };
			this.unifiedTimeline.push(activeAssistantMessage);
			if (this.onTimelineUpdated) this.onTimelineUpdated();

			while (llmResponse.toolCalls && llmResponse.toolCalls.length > 0 && iterations < maxIterations) {
				iterations++;

				// Loop Detection
				let loopDetected = false;
				for (const tc of llmResponse.toolCalls) {
					const signature = `${tc.name}:${JSON.stringify(tc.arguments)}`;
					toolCallHistory[signature] = (toolCallHistory[signature] || 0) + 1;
					if (toolCallHistory[signature] >= 3) {
						loopDetected = true;
						this.plugin.logger.log('SYSTEM_WARNING', { message: `Infinite loop detected for tool: ${tc.name}. Aborting.` });
						break;
					}
				}

				if (loopDetected) {
					activeAssistantMessage.content += `\n\n*(System Note: I detected that I was stuck in a repetitive loop trying to use the same tool multiple times. I have aborted the current operation to save tokens.)*`;
					break;
				}

				// Show intermediate reasoning if provided
				if (llmResponse.content) {
					activeAssistantMessage.content += (activeAssistantMessage.content ? '\n\n' : '') + llmResponse.content;
					if (this.onTimelineUpdated) this.onTimelineUpdated();
				}

				history.push({ 
					role: 'assistant', 
					content: llmResponse.content || '', 
					toolCalls: llmResponse.toolCalls 
				});

				for (const tc of llmResponse.toolCalls) {
					this.plugin.logger.log('AUTONOMOUS_TOOL_EXECUTION', { tool: tc.name, args: tc.arguments });
					
					if (tc.name === 'transfer_session') {
						const args = tc.arguments;
						const targetPersona = args.target_persona;
						const handoffMsg = args.handoff_context;

						const handoffNotice = `*Transferred session to **${targetPersona}**.*\n\n> ${handoffMsg}`;
						activeAssistantMessage.content += (activeAssistantMessage.content ? '\n\n' : '') + handoffNotice;
						history.push({ role: 'tool', content: `Session successfully transferred to ${targetPersona}.`, toolCallId: tc.id, toolName: tc.name });

						const targetHistory = this.getAgentHistory(targetPersona);
						const recentContext = this.unifiedTimeline.slice(-6).map((m: any) => `[${m.persona || m.role}]: ${m.content}`).join('\n\n');
						const fullHandoffMessage = `[SYSTEM HANDOFF from ${personaName}]: ${handoffMsg}\n\n### Recent Conversation Context:\n${recentContext}\n\nPlease take over the conversation and assist the user immediately based on this context.`;
						
						targetHistory.push({ role: 'user', content: fullHandoffMessage, persona: 'System' });

						if (this.onPersonaChanged) this.onPersonaChanged(targetPersona);
						this.persistState();
						await this.sendMessage("", targetPersona);
						return handoffNotice;

					} else if (tc.name === 'load_skill') {
						const args = tc.arguments;
						const skillId = args.skill_id;
						const body = this.plugin.skillsEngine.getSkillBody(skillId);
						
						let toolOutputStr = body ? `[Skill Instructions Loaded: ${skillId}]\n\n${body}` : `Error: Skill '${skillId}' not found.`;

						// Show visually in the UI box
						activeAssistantMessage.content += (activeAssistantMessage.content ? '\n\n' : '') + `<details><summary>🧠 Loaded Skill: ${skillId}</summary>\n\n\`\`\`text\n${toolOutputStr}\n\`\`\`\n</details>`;
						if (this.onTimelineUpdated) this.onTimelineUpdated();

						history.push({ role: 'tool', content: toolOutputStr, toolCallId: tc.id, toolName: tc.name });
						this.persistState();
						continue; 
					} else if (tc.name === 'request_approval') {
						const args = tc.arguments;
						const summary = args.action_summary || 'Unknown Action';
						const reason = args.reason || 'No reason provided';
						
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

						if (this.onTimelineUpdated) this.onTimelineUpdated();
						this.persistState();
						return msg; // Returning early completely stops the ReAct loop!
					}

					if (this.plugin.mcpEngine.availableTools[tc.name]) {
						const executingToken = `\n\n> ⚙️ **Executing MCP tool: ${tc.name}**...`;
						activeAssistantMessage.content += executingToken;
						if (this.onTimelineUpdated) this.onTimelineUpdated();

						let toolOutputStr = '';
						try {
							const mcpRes = await this.plugin.mcpEngine.executeTool(tc.name, tc.arguments);
							toolOutputStr = JSON.stringify(mcpRes, null, 2);
						} catch (e: unknown) {
							toolOutputStr = `ERROR: ${(e as Error).message}\n\n[SYSTEM DIRECTIVE]: Tool execution failed. Do NOT report this failure to the user yet. You must autonomously analyze the error, correct your arguments or approach, and retry.`;
						}

						const finishedToken = `\n\n<details><summary>⚙️ Executed MCP tool: ${tc.name}</summary>\n\n\`\`\`text\n${toolOutputStr}\n\`\`\`\n</details>`;
						activeAssistantMessage.content = activeAssistantMessage.content.replace(executingToken, finishedToken);
						if (this.onTimelineUpdated) this.onTimelineUpdated();

						history.push({
							role: 'tool',
							content: toolOutputStr,
							toolCallId: tc.id,
							toolName: tc.name
						});
						continue;
					}

					// Inject in-progress tool message visually
					const executingToken = `\n\n> ⚙️ **Executing tool: ${tc.name}**...`;
					activeAssistantMessage.content += executingToken;
					if (this.onTimelineUpdated) this.onTimelineUpdated();

					// Execute Sandbox for standard tools
					const sandboxRes = await this.plugin.executionSandbox.executeTool(tc.name, tc.arguments);
					
					// Replace in-progress token with details block
					const toolOutputStr = sandboxRes.success ? sandboxRes.output : `ERROR: ${sandboxRes.output}\n\n[SYSTEM DIRECTIVE]: Tool execution failed. Do NOT report this failure to the user yet. You must autonomously analyze the error, correct your arguments or approach, and retry.`;
					const finishedToken = `\n\n<details><summary>⚙️ Executed tool: ${tc.name}</summary>\n\n\`\`\`text\n${toolOutputStr}\n\`\`\`\n</details>`;
					activeAssistantMessage.content = activeAssistantMessage.content.replace(executingToken, finishedToken);
					if (this.onTimelineUpdated) this.onTimelineUpdated();

					// Append to history as tool response
					history.push({
						role: 'tool',
						content: toolOutputStr,
						toolCallId: tc.id,
						toolName: tc.name
					});
				}

				// Re-query LLM with tool outputs
				const followupPayload: LLMMessage[] = [
					{ role: 'system', content: systemPrompt },
					...history
				];
				
				llmResponse = await provider.generateResponse(followupPayload, tools);
				this.plugin.logger.log('LLM_FOLLOWUP_RESPONSE', llmResponse);
			}

			if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0 && iterations >= maxIterations) {
				const errResponse = `[${personaName}] I reached the maximum tool execution depth and had to stop.`;
				activeAssistantMessage.content += (activeAssistantMessage.content ? '\n\n' : '') + errResponse;
				history.push({ role: 'assistant', content: errResponse, persona: personaName });
				this.persistState();
				return errResponse;
			}

			const finalContent = llmResponse.content || '';
			if (finalContent) {
				activeAssistantMessage.content += (activeAssistantMessage.content ? '\n\n' : '') + finalContent;
				history.push({ role: 'assistant', content: finalContent, persona: personaName });
			}
			
			if (!activeAssistantMessage.content) {
				activeAssistantMessage.content = '[Empty response]';
			}

			if (this.onTimelineUpdated) this.onTimelineUpdated();
			this.persistState();
			return activeAssistantMessage.content;
			
		} catch (error: any) {
			this.plugin.logger.log('LLM_API_ERROR', { error: error.message });
			let errResponse = `Error connecting to ${this.plugin.settings.llmProvider}: ${error.message}`;
			
			if (error.message && (
				error.message.toLowerCase().includes('key') || 
				error.message.toLowerCase().includes('model') || 
				error.message.toLowerCase().includes('unauthorized') || 
				error.message.toLowerCase().includes('not found') ||
				error.message.toLowerCase().includes('401') ||
				error.message.toLowerCase().includes('404')
			)) {
				errResponse += `\n\n⚠️ **Troubleshooting:** It looks like your API key or selected model might be invalid. Please go to **Settings → Community plugins → Agentic Vault** and use the **Test Key & Load Models** button to verify your configuration.`;
			}
			
			this.unifiedTimeline.push({ role: 'assistant', content: errResponse, persona: personaName });
			history.push({ role: 'assistant', content: errResponse, persona: personaName });
			this.persistState();
			return errResponse;
		}
	}
	
	async clearHistory() {
		// Archive session before clearing
		if (this.unifiedTimeline.length > 0) {
			const now = new Date();
			const timestamp = now.toISOString().replace(/[:.]/g, '-');
			const sessionContent = this.unifiedTimeline.map(msg => `**[${msg.persona || msg.role}] (${msg.role}):**\n${msg.content}\n---`).join('\n\n');
			const archivePath = `AgenticVault/logs/sessions/${timestamp}_Session.md`;
			
			try {
				const dir = 'AgenticVault/logs/sessions';
				if (!(await this.plugin.app.vault.adapter.exists(dir))) {
					await this.plugin.app.vault.adapter.mkdir(dir);
				}
				await this.plugin.app.vault.adapter.write(archivePath, sessionContent);
			} catch (e) {
				console.error("Failed to archive session:", e);
			}
		}

		this.unifiedTimeline = [];
		this.agentContexts = {};
		this.persistState();
		if (this.onTimelineUpdated) this.onTimelineUpdated();
	}
}
