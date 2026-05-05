import type AgenticVaultPlugin from '../main';
import { LLMMessage, LLMProvider } from "../llm/LLMProvider";
import { GeminiProvider } from "../llm/GeminiProvider";
import { OpenAIProvider } from "../llm/OpenAIProvider";

import { PromptCompiler } from "../core/PromptCompiler";
import { NativeToolHandler } from "../core/NativeToolHandler";

export type { LLMMessage as ChatMessage } from "../llm/LLMProvider";

export class ChatService {
	plugin: AgenticVaultPlugin;
	unifiedTimeline: LLMMessage[] = [];
	agentContexts: Record<string, LLMMessage[]> = {};
	onPersonaChanged?: (newPersona: string) => void;
	onTimelineUpdated?: () => void;
	isProcessing: boolean = false;
	backgroundTasks: Set<string> = new Set();
	currentStatus: string = '';
	private nativeToolHandler: NativeToolHandler;

	constructor(plugin: AgenticVaultPlugin) {
		this.plugin = plugin;
		this.nativeToolHandler = new NativeToolHandler(this.plugin);
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

	isPersonaBusy(personaName: string): boolean {
		const activeTasks = this.plugin.routineManager.getTasks().filter(t => t.status === 'running');
		return activeTasks.some(t => {
			const routine = this.plugin.routineManager.getRoutines().find(r => r.id === t.routineId);
			return routine && routine.agent === personaName;
		});
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

	abortBackgroundTask(taskId: string) {
		this.backgroundTasks.delete(taskId);
	}

	async sendMessage(message: string, personaName: string, senderOverride?: string, taskId?: string, isInternalHandoff: boolean = false): Promise<string> {
		if (taskId) {
			this.backgroundTasks.add(taskId);
		} else {
			if (!isInternalHandoff && this.isProcessing) {
				throw new Error("ChatService is already processing a request.");
			}
			this.isProcessing = true;
			if (this.onTimelineUpdated) this.onTimelineUpdated();
		}

		const isStillActive = () => {
			if (taskId) return this.backgroundTasks.has(taskId);
			return this.isProcessing;
		};

		try {
			let history: LLMMessage[] = [];
			
			if (taskId) {
				// Isolate history for background spawn
				history = [...this.getAgentHistory(personaName)];
			} else {
				history = this.getAgentHistory(personaName);
			}
			
			if (message) {
				const msgPersona = senderOverride || personaName;
				const newMsg: LLMMessage = { role: 'user', content: message, persona: msgPersona };
				history.push(newMsg);
				
				if (!taskId) {
					this.unifiedTimeline.push(newMsg);
					this.plugin.logger.log('USER_MESSAGE_SUBMITTED', { text: message, persona: msgPersona });
					this.persistState();
				}
			}
			
			if (!taskId) {
				this.currentStatus = `Compiling context for ${personaName}...`;
				if (this.onTimelineUpdated) this.onTimelineUpdated();
			}

			const systemPrompt = await PromptCompiler.compileSystemPrompt(this.plugin, personaName);

			if (!taskId) {
				this.plugin.logger.log('LLM_REQUEST_INITIATED', { message, persona: personaName, systemPrompt });
			}
		
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
			const executionFleet = this.plugin.personaEngine.getPersonaByName(personaName)?.fleet;
			const result = await this.plugin.executionSandbox.executeTool(toolName, payload, executionFleet);
			if (result.success) response += `**Sandbox Output:**\n\`\`\`json\n${result.output}\n\`\`\``;
			else response += `**Sandbox Error:**\n\`\`\`text\n${result.output}\n\`\`\``;
			
			this.unifiedTimeline.push({ role: 'assistant', content: response, persona: personaName });
			history.push({ role: 'assistant', content: response, persona: personaName });
			this.persistState();
			return response;
		} 

		// Full ReAct Loop
		const provider = this.getProvider();
			const persona = this.plugin.personaEngine.getPersonaByName(personaName);
			const allTools = [
				...this.plugin.toolRegistry.getAllTools(persona?.fleet),
				...this.plugin.mcpEngine.getMcpToolsAsRegistryFormat()
			];
			
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

			// Inject Native Tool for Managing Routines
			tools.push({
				name: 'manage_routines',
				description: 'View the status of the background task queue, list available routines, or manually trigger a routine.',
				language: 'native',
				scriptContent: '',
				parameters: [
					{ name: 'action', type: 'string', description: 'What to do: "list_routines" (to see all configured routines), "view_queue" (to see the recent tasks), or "trigger" (to spawn a new task).', required: true },
					{ name: 'routine_id', type: 'string', description: 'Required only if action is "trigger". The ID of the routine to spawn.', required: false }
				]
			});
			
			// Build payload with system prompt
			const payload: LLMMessage[] = [
				{ role: 'system', content: systemPrompt },
				...history
			];

			if (!taskId) {
				this.currentStatus = `Awaiting AI reasoning from ${personaName}...`;
				if (this.onTimelineUpdated) this.onTimelineUpdated();
			}

			let llmResponse = await provider.generateResponse(payload, tools);
			this.plugin.logger.log('LLM_RAW_RESPONSE', llmResponse);

			if (!isStillActive()) return 'Aborted.';

			// Handle Tool Calling Loop
			let iterations = 0;
			const maxIterations = 15;
			const toolCallHistory: Record<string, number> = {};

			// Create a single active assistant message
			const activeAssistantMessage: any = { role: 'assistant', content: '', persona: personaName };
			
			if (!taskId) {
				this.unifiedTimeline.push(activeAssistantMessage);
				if (this.onTimelineUpdated) this.onTimelineUpdated();
			}

			while (llmResponse.toolCalls && llmResponse.toolCalls.length > 0 && iterations < maxIterations) {
				if (!isStillActive()) break;
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
					if (!taskId && this.onTimelineUpdated) this.onTimelineUpdated();
				}

				history.push({ 
					role: 'assistant', 
					content: llmResponse.content || '', 
					toolCalls: llmResponse.toolCalls 
				});

				for (const tc of llmResponse.toolCalls) {
					this.plugin.logger.log('AUTONOMOUS_TOOL_EXECUTION', { tool: tc.name, args: tc.arguments });
					
					const nativeRes = await this.nativeToolHandler.handle(tc, personaName, activeAssistantMessage, history);
					if (nativeRes.handled) {
						if (nativeRes.haltReAct) {
							return nativeRes.responseMessage || '';
						}
						continue;
					}

					if (this.plugin.mcpEngine.availableTools[tc.name]) {
						if (!taskId) {
							this.currentStatus = `Executing MCP tool: ${tc.name}...`;
						}
						const executingToken = `\n\n> ⚙️ **Executing MCP tool: ${tc.name}**...`;
						activeAssistantMessage.content += executingToken;
						if (!taskId && this.onTimelineUpdated) this.onTimelineUpdated();

						let toolOutputStr = '';
						try {
							const mcpRes = await this.plugin.mcpEngine.executeTool(tc.name, tc.arguments);
							toolOutputStr = JSON.stringify(mcpRes, null, 2);
						} catch (e: unknown) {
							toolOutputStr = `ERROR: ${(e as Error).message}\n\n[SYSTEM DIRECTIVE]: Tool execution failed. Do NOT report this failure to the user yet. You must autonomously analyze the error, correct your arguments or approach, and retry.`;
						}

						const finishedToken = `\n\n<details><summary>⚙️ Executed MCP tool: ${tc.name}</summary>\n\n\`\`\`text\n${toolOutputStr}\n\`\`\`\n</details>`;
						activeAssistantMessage.content = activeAssistantMessage.content.replace(executingToken, finishedToken);
						if (!taskId && this.onTimelineUpdated) this.onTimelineUpdated();

						history.push({
							role: 'tool',
							content: toolOutputStr,
							toolCallId: tc.id,
							toolName: tc.name
						});
						continue;
					}

					if (!taskId) {
						this.currentStatus = `Executing local tool: ${tc.name}...`;
					}
					// Inject in-progress tool message visually
					const executingToken = `\n\n> ⚙️ **Executing tool: ${tc.name}**...`;
					activeAssistantMessage.content += executingToken;
					if (!taskId && this.onTimelineUpdated) this.onTimelineUpdated();

					// Execute Sandbox for standard tools
					const executionFleet = persona?.fleet;
					const sandboxRes = await this.plugin.executionSandbox.executeTool(tc.name, tc.arguments, executionFleet);
					
					// Intercept dynamic zone allocation
					if (sandboxRes.success) {
						try {
							const parsed = JSON.parse(sandboxRes.output);
							if (parsed._INTERNAL_ALLOCATE_ZONE_TRIGGER) {
								const { zone_id, path, description } = parsed._INTERNAL_ALLOCATE_ZONE_TRIGGER;
								if (zone_id === 'agentic_vault') {
									const oldPath = this.plugin.settings.agenticVaultPath;
									if (oldPath !== path) {
										try {
											const oldFolder = this.plugin.app.vault.getAbstractFileByPath(oldPath);
											if (oldFolder) {
												await this.plugin.app.fileManager.renameFile(oldFolder, path);
											}
											this.plugin.settings.agenticVaultPath = path;
											await this.plugin.saveSettings();
											this.plugin.logger.log('SYSTEM_INFO', { message: `Renamed agentic_vault to ${path}` });
										} catch (err) {
											this.plugin.logger.log('SYSTEM_ERROR', { message: `Failed to rename agentic_vault: ${err}` });
										}
									}
								} else {
									this.plugin.settings.zones[zone_id] = { path, description };
									await this.plugin.saveSettings();
									this.plugin.logger.log('SYSTEM_INFO', { message: `Dynamically allocated zone: ${zone_id} -> ${path}` });
								}
							}
							if (parsed._INTERNAL_INSTALL_FLEET_TRIGGER) {
								const { fleet_name } = parsed._INTERNAL_INSTALL_FLEET_TRIGGER;
								const { InitializationEngine } = await import('../core/InitializationEngine');
								const engine = new InitializationEngine(this.plugin);
								await engine.deployFleet(fleet_name);
								await this.plugin.personaEngine.loadPersonas();
								await this.plugin.toolRegistry.loadTools();
								this.plugin.logger.log('SYSTEM_INFO', { message: `Dynamically installed fleet: ${fleet_name}` });
							}
						} catch (e) {
							// Ignored if output is not JSON
						}
					}

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
				
				this.currentStatus = `Analyzing tool execution results...`;
				if (this.onTimelineUpdated) this.onTimelineUpdated();

				llmResponse = await provider.generateResponse(followupPayload, tools);
				this.plugin.logger.log('LLM_FOLLOWUP_RESPONSE', llmResponse);
			}

			if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0 && iterations >= maxIterations) {
				const errResponse = `[${personaName}] I reached the maximum tool execution depth and had to stop.`;
				activeAssistantMessage.content += (activeAssistantMessage.content ? '\n\n' : '') + errResponse;
				if (!taskId) {
					history.push({ role: 'assistant', content: errResponse, persona: personaName });
					this.persistState();
				}
				// The handoff will handle pushing to unifiedTimeline for background tasks
			}

			const finalContent = llmResponse.content || '';
			if (finalContent) {
				activeAssistantMessage.content += (activeAssistantMessage.content ? '\n\n' : '') + finalContent;
				history.push({ role: 'assistant', content: finalContent, persona: personaName });
			}
			
			if (!activeAssistantMessage.content) {
				activeAssistantMessage.content = '[Empty response]';
			}

			if (taskId) {
				// Inject the final summary into the main timelines
				const task = this.plugin.routineManager.getTasks().find(t => t.id === taskId);
				const routineName = task ? task.routineId : taskId;
				const routine = this.plugin.routineManager.getRoutines().find(r => r.id === routineName);
				const header = `> ⚙️ **[Background Routine Completed: ${routine ? routine.name : routineName}]**\n\n`;
				
				const finalMsg: LLMMessage = { role: 'assistant', content: header + activeAssistantMessage.content, persona: personaName };
				this.unifiedTimeline.push(finalMsg);
				this.getAgentHistory(personaName).push(finalMsg);
				this.persistState();
				if (this.onTimelineUpdated) this.onTimelineUpdated();
			} else {
				if (this.onTimelineUpdated) this.onTimelineUpdated();
				this.persistState();
			}
			
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
			
			if (taskId) {
				const task = this.plugin.routineManager.getTasks().find(t => t.id === taskId);
				const routineName = task ? task.routineId : taskId;
				const routine = this.plugin.routineManager.getRoutines().find(r => r.id === routineName);
				const header = `> ⚠️ **[Background Routine Failed: ${routine ? routine.name : routineName}]**\n\n`;
				const finalMsg: LLMMessage = { role: 'assistant', content: header + errResponse, persona: personaName };
				this.unifiedTimeline.push(finalMsg);
				this.getAgentHistory(personaName).push(finalMsg);
			} else {
				this.unifiedTimeline.push({ role: 'assistant', content: errResponse, persona: personaName });
				this.getAgentHistory(personaName).push({ role: 'assistant', content: errResponse, persona: personaName });
			}
			
			this.persistState();
			return errResponse;
		} finally {
			if (taskId) {
				this.backgroundTasks.delete(taskId);
			} else if (!isInternalHandoff) {
				this.isProcessing = false;
				this.currentStatus = '';
				if (this.onTimelineUpdated) this.onTimelineUpdated();
			}
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

	public abortProcessing() {
		this.isProcessing = false;
		this.currentStatus = 'Aborted by user.';
		if (this.onTimelineUpdated) this.onTimelineUpdated();
	}
}
