import { ItemView, WorkspaceLeaf, MarkdownRenderer, Notice } from 'obsidian';
import AgenticVaultPlugin from '../main';
import { ChatMessage } from '../services/ChatService';
import { Persona } from '../core/PersonaEngine';

export const VIEW_TYPE_CAREER_SHERPA_CHAT = 'agentic-vault-chat-view';

export class AgenticVaultChatView extends ItemView {
	plugin: AgenticVaultPlugin;
	activePersona: string = 'Pager'; // Default persona
	messagesContainerEl: HTMLElement;
	personaIndicatorEl: HTMLElement;
	isThinking: boolean = false;

	constructor(leaf: WorkspaceLeaf, plugin: AgenticVaultPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CAREER_SHERPA_CHAT;
	}

	getDisplayText(): string {
		return 'Agentic Vault Chat';
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('agentic-vault-chat-container');

		if (!this.plugin.settings.hasCompletedOnboarding) {
			void this.renderOnboarding(contentEl);
			return;
		}
		
		this.renderChatInterface(contentEl);
	}

	renderChatInterface(contentEl: HTMLElement) {
		contentEl.style.display = 'flex';
		contentEl.style.flexDirection = 'column';
		contentEl.style.height = '100%';

		// 1. Messages Area
		this.messagesContainerEl = contentEl.createDiv({ cls: 'chat-messages' });
		this.messagesContainerEl.style.flexGrow = '1';
		this.messagesContainerEl.style.overflowY = 'auto';
		this.messagesContainerEl.style.marginBottom = '10px';
		this.messagesContainerEl.style.padding = '10px';
		this.messagesContainerEl.style.border = '1px solid var(--background-modifier-border)';
		this.messagesContainerEl.style.borderRadius = '5px';
		this.messagesContainerEl.style.display = 'flex';
		this.messagesContainerEl.style.flexDirection = 'column';

		this.renderHistory();

		// 2. Input Wrapper (Contains Persona Indicator, Suggestion Box, and Input)
		const bottomWrapper = contentEl.createDiv({ cls: 'chat-bottom-wrapper' });
		bottomWrapper.style.position = 'relative';
		bottomWrapper.style.display = 'flex';
		bottomWrapper.style.flexDirection = 'column';
		bottomWrapper.style.gap = '5px';
		bottomWrapper.style.flexShrink = '0';
		bottomWrapper.style.paddingBottom = '15px'; // Prevent cutoff from bottom bar decorations

		// Top bar of input wrapper
		const topBar = bottomWrapper.createDiv();
		topBar.style.display = 'flex';
		topBar.style.justifyContent = 'space-between';
		topBar.style.alignItems = 'center';

		// Persona Indicator
		this.personaIndicatorEl = topBar.createDiv({ cls: 'persona-badge' });
		this.personaIndicatorEl.style.fontSize = '0.8em';
		this.personaIndicatorEl.style.color = 'var(--text-muted)';
		this.personaIndicatorEl.style.fontWeight = 'bold';
		this.personaIndicatorEl.style.textTransform = 'uppercase';
		this.personaIndicatorEl.setText(`Speaking to: ${this.activePersona}`);

		const clearBtn = topBar.createEl('button');
		clearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;
		clearBtn.setAttribute('aria-label', 'Clear and archive chat session');
		clearBtn.style.padding = '6px';
		clearBtn.style.display = 'flex';
		clearBtn.style.alignItems = 'center';
		clearBtn.style.justifyContent = 'center';
		clearBtn.style.backgroundColor = 'transparent';
		clearBtn.style.color = 'var(--text-muted)';
		clearBtn.style.border = 'none';
		clearBtn.style.cursor = 'pointer';
		clearBtn.style.borderRadius = '5px';

		clearBtn.addEventListener('mouseenter', () => clearBtn.style.color = 'var(--interactive-accent)');
		clearBtn.addEventListener('mouseleave', () => clearBtn.style.color = 'var(--text-muted)');

		clearBtn.onclick = async () => {
			await this.plugin.chatService.clearHistory();
			this.activePersona = 'Pager';
			this.renderHistory();
			this.personaIndicatorEl.setText(`Speaking to: ${this.activePersona}`);
		};

		// Suggestion Box
		const suggestionBoxEl = bottomWrapper.createDiv({ cls: 'chat-suggestions' });
		suggestionBoxEl.style.display = 'none';
		suggestionBoxEl.style.position = 'absolute';
		suggestionBoxEl.style.bottom = '100%';
		suggestionBoxEl.style.left = '0';
		suggestionBoxEl.style.width = '100%';
		suggestionBoxEl.style.backgroundColor = 'var(--background-secondary)';
		suggestionBoxEl.style.border = '1px solid var(--background-modifier-border)';
		suggestionBoxEl.style.borderRadius = '5px';
		suggestionBoxEl.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
		suggestionBoxEl.style.zIndex = '10';
		suggestionBoxEl.style.marginBottom = '5px';
		suggestionBoxEl.style.padding = '5px';
		
		// Input Box Row
		const inputRow = bottomWrapper.createDiv();
		inputRow.style.position = 'relative';
		inputRow.style.display = 'flex';
		inputRow.style.width = '100%';

		const inputEl = inputRow.createEl('textarea', { 
			placeholder: 'Type a message... (try /)'
		});
		inputEl.style.width = '100%';
		inputEl.style.resize = 'none';
		inputEl.style.minHeight = '36px';
		inputEl.style.maxHeight = '200px';
		inputEl.style.overflowY = 'auto';
		inputEl.style.fontFamily = 'inherit';
		inputEl.style.lineHeight = '1.5';
		inputEl.style.padding = '8px 40px 8px 8px';
		inputEl.style.borderRadius = '5px';
		inputEl.style.border = '1px solid var(--background-modifier-border)';
		inputEl.style.backgroundColor = 'var(--background-primary)';
		inputEl.style.color = 'var(--text-normal)';

		inputEl.addEventListener('input', () => {
			inputEl.style.height = 'auto';
			inputEl.style.height = `${inputEl.scrollHeight}px`;
		});

		const sendBtn = inputRow.createEl('button');
		sendBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
		sendBtn.style.position = 'absolute';
		sendBtn.style.right = '5px';
		sendBtn.style.bottom = '5px';
		sendBtn.style.padding = '6px';
		sendBtn.style.display = 'flex';
		sendBtn.style.alignItems = 'center';
		sendBtn.style.justifyContent = 'center';
		sendBtn.style.backgroundColor = 'transparent';
		sendBtn.style.color = 'var(--text-muted)';
		sendBtn.style.border = 'none';
		sendBtn.style.cursor = 'pointer';
		sendBtn.style.borderRadius = '5px';

		sendBtn.addEventListener('mouseenter', () => sendBtn.style.color = 'var(--interactive-accent)');
		sendBtn.addEventListener('mouseleave', () => sendBtn.style.color = 'var(--text-muted)');

		// Autocomplete State
		let currentSuggestions: Persona[] = [];
		let highlightedIndex = 0;

		// Handle background persona changes
		this.plugin.chatService.onPersonaChanged = (newPersona: string) => {
			this.activePersona = newPersona;
			if (this.personaIndicatorEl) this.personaIndicatorEl.setText(`Speaking to: ${this.activePersona}`);
			// Small delay to allow ChatService to finish returning the handoff notice
			setTimeout(() => {
				this.renderHistory();
			}, 200);
		};

		this.plugin.chatService.onTimelineUpdated = () => {
			this.renderHistory();
		};

		const renderSuggestions = () => {
			suggestionBoxEl.empty();
			if (currentSuggestions.length === 0) {
				suggestionBoxEl.style.display = 'none';
				return;
			}
			suggestionBoxEl.style.display = 'block';
			
			currentSuggestions.forEach((cmd, idx) => {
				const item = suggestionBoxEl.createDiv();
				item.style.padding = '5px 10px';
				item.style.cursor = 'pointer';
				item.style.borderRadius = '3px';
				
				if (idx === highlightedIndex) {
					item.style.backgroundColor = 'var(--interactive-accent)';
					item.style.color = 'var(--text-on-accent)';
				} else {
					item.style.backgroundColor = 'transparent';
					item.style.color = 'var(--text-normal)';
				}

				item.createEl('strong', { text: cmd.cmd });
				item.createSpan({ text: ` - ${cmd.name}` });
			});
		};

		// Slash Command Router Logic
		inputEl.addEventListener('input', (e) => {
			const val = inputEl.value;
			const personas = this.plugin.personaEngine.getAllPersonas();

			// Handle Persona Switching
			const matchedPersona = personas.find(p => val === `${p.cmd} `);
			if (matchedPersona) {
				this.activePersona = matchedPersona.name;
				if (this.personaIndicatorEl) this.personaIndicatorEl.setText(`Speaking to: ${this.activePersona}`);
				this.plugin.logger.log('SLASH_COMMAND_ROUTED', { newPersona: this.activePersona, rawInput: val });
				inputEl.value = '';
				currentSuggestions = [];
				renderSuggestions();
				return;
			}

			// Handle Autocomplete Suggestions
			if (val.startsWith('/')) {
				currentSuggestions = personas.filter(p => p.cmd.startsWith(val.trim()));
				highlightedIndex = 0;
				renderSuggestions();
			} else {
				currentSuggestions = [];
				renderSuggestions();
			}
		});

		inputEl.addEventListener('keydown', (e) => {
			if (suggestionBoxEl.style.display === 'block' && currentSuggestions.length > 0) {
				if (e.key === 'Tab') {
					e.preventDefault();
					const selected = currentSuggestions[highlightedIndex];
					if (selected) {
						inputEl.value = `${selected.cmd} `;
						inputEl.dispatchEvent(new Event('input'));
					}
					return;
				} else if (e.key === 'ArrowDown') {
					e.preventDefault();
					highlightedIndex = (highlightedIndex + 1) % currentSuggestions.length;
					renderSuggestions();
					return;
				} else if (e.key === 'ArrowUp') {
					e.preventDefault();
					highlightedIndex = (highlightedIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
					renderSuggestions();
					return;
				}
			}

			if (e.key === 'Enter' && !e.shiftKey) {
				// If autocomplete is open and they press enter, autocomplete it
				if (suggestionBoxEl.style.display === 'block' && currentSuggestions.length > 0) {
					e.preventDefault();
					const selected = currentSuggestions[highlightedIndex];
					if (selected) {
						inputEl.value = `${selected.cmd} `;
						inputEl.dispatchEvent(new Event('input'));
					}
					return;
				}
				e.preventDefault(); // Prevent default newline insertion
				handleSend();
			}
		});

		const handleSend = async () => {
			const text = inputEl.value.trim();
			if (!text) return;
			
			this.plugin.logger.log('USER_MESSAGE_SUBMITTED', { text, persona: this.activePersona });
			
			inputEl.value = '';
			inputEl.style.height = 'auto'; // Reset height after sending
			inputEl.disabled = true;
			sendBtn.disabled = true;

			// Send to service (synchronously adds user message to timeline)
			const sendPromise = this.plugin.chatService.sendMessage(text, this.activePersona);
			
			// Show user message and thinking indicator instantly
			this.isThinking = true;
			this.renderHistory();

			// Wait for response and any chained handoffs
			await sendPromise;
			
			// Show final assistant response
			this.isThinking = false;
			this.renderHistory();

			inputEl.disabled = false;
			sendBtn.disabled = false;
			inputEl.focus();
		};

		sendBtn.addEventListener('click', handleSend);
	}

	async renderOnboarding(contentEl: HTMLElement) {
		contentEl.style.display = 'block';
		contentEl.style.padding = '20px';
		contentEl.style.overflowY = 'auto';

		contentEl.createEl("h2", { text: "Welcome to Agentic Vault" });
		contentEl.createEl("p", { 
			text: "Agentic Vault uses the PARA method (Projects, Areas, Resources, Archives) to organize your vault. Let's set up your default folders."
		});

		const form = contentEl.createDiv();
		form.style.display = 'flex';
		form.style.flexDirection = 'column';
		form.style.gap = '15px';
		form.style.marginTop = '20px';

		const addSetting = (name: string, desc: string, key: keyof typeof this.plugin.settings) => {
			const row = form.createDiv();
			row.createEl('strong', { text: name });
			row.createEl('div', { text: desc }).style.fontSize = '0.85em';
			const input = row.createEl('input', { type: 'text' });
			input.value = this.plugin.settings[key] as string || '';
			input.style.width = '100%';
			input.style.marginTop = '5px';
			input.onchange = async () => {
				// @ts-ignore
				this.plugin.settings[key] = input.value;
				await this.plugin.saveSettings();
			};
		};

		addSetting('Root Folder', 'Optional root folder (leave empty for vault root)', 'rootFolder');
		addSetting('Projects', 'Path for active projects.', 'projectsPath');
		addSetting('Areas', 'Path for active areas of responsibility.', 'areasPath');
		addSetting('Resources', 'Path for resources and reference material.', 'resourcesPath');
		addSetting('Archives', 'Path for completed or inactive items.', 'archivesPath');
		addSetting('Agentic Vault OS', 'Path for configuration and personas.', 'agenticVaultPath');

		const btn = form.createEl('button', { text: 'Initialize Vault' });
		btn.style.marginTop = '10px';
		btn.style.backgroundColor = 'var(--interactive-accent)';
		btn.style.color = 'var(--text-on-accent)';
		btn.style.cursor = 'pointer';

		btn.onclick = async () => {
			btn.disabled = true;
			btn.textContent = 'Initializing...';
			await this.initializeVault();
		};
	}

	async initializeVault() {
		const root = this.plugin.settings.rootFolder ? `${this.plugin.settings.rootFolder}/` : '';
		
		const paths = [
			`${root}${this.plugin.settings.projectsPath}`,
			`${root}${this.plugin.settings.areasPath}`,
			`${root}${this.plugin.settings.resourcesPath}`,
			`${root}${this.plugin.settings.archivesPath}`,
			`${root}${this.plugin.settings.agenticVaultPath}`,
			`${root}${this.plugin.settings.agenticVaultPath}/personas`,
			`${root}${this.plugin.settings.agenticVaultPath}/tools`
		];

		try {
			for (const p of paths) {
				const path = p.replace(/\/+/g, '/').replace(/\/$/, '');
				if (path && !this.plugin.app.vault.getAbstractFileByPath(path)) {
					await this.plugin.app.vault.createFolder(path);
				}
			}
			
			const agenticVaultPath = `${root}${this.plugin.settings.agenticVaultPath}`.replace(/\/+/g, '/').replace(/\/$/, '');

			// Generate default personas
			const pagerPath = `${agenticVaultPath}/personas/pager.md`;
			if (agenticVaultPath && !this.plugin.app.vault.getAbstractFileByPath(pagerPath)) {
				const pagerContent = `---
name: Pager
cmd: /pager
description: The strict meta-orchestrator and front-desk router of the AI system.
---

You are the Pager, the strict meta-orchestrator and front-desk router of the AI system.

CRITICAL DIRECTIVE: You MUST NEVER answer a user's question, provide advice, or execute analysis directly. You are STRICTLY an orchestrator. Your ONLY job is to identify what the user needs and immediately use the \`transfer_session\` tool to route them to the correct expert.`;
				await this.plugin.app.vault.create(pagerPath, pagerContent);
			}

			const cosPath = `${agenticVaultPath}/personas/chief_of_staff.md`;
			if (agenticVaultPath && !this.plugin.app.vault.getAbstractFileByPath(cosPath)) {
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
				await this.plugin.app.vault.create(cosPath, cosContent);
			}

			// Generate default echo tool
			const echoToolPath = `${agenticVaultPath}/tools/echo.md`;
			if (agenticVaultPath && !this.plugin.app.vault.getAbstractFileByPath(echoToolPath)) {
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
				await this.plugin.app.vault.create(echoToolPath, echoContent);
			}
			
			this.plugin.settings.hasCompletedOnboarding = true;
			await this.plugin.saveSettings();
			
			// Re-render chat
			const { contentEl } = this;
			contentEl.empty();
			this.renderChatInterface(contentEl);
			
			new Notice("Agentic Vault initialized!");
		} catch (e: unknown) {
			new Notice("Error initializing vault folders. See console.");
			console.error(e);
		}
	}

	renderHistory() {
		this.messagesContainerEl.empty();
		for (const msg of this.plugin.chatService.unifiedTimeline) {
			this.appendMessage(msg);
		}
		
		if (this.isThinking) {
			const msgEl = this.messagesContainerEl.createDiv({ cls: `chat-message thinking` });
			msgEl.style.marginBottom = '15px';
			msgEl.style.padding = '12px';
			msgEl.style.borderRadius = '8px';
			msgEl.style.border = '1px solid var(--background-modifier-border)';
			msgEl.style.backgroundColor = 'var(--background-secondary)';
			msgEl.style.color = 'var(--text-muted)';
			msgEl.style.fontStyle = 'italic';
			msgEl.style.opacity = '0.8';
			msgEl.setText(`🧠 ${this.activePersona} is thinking...`);
		}
		
		this.messagesContainerEl.scrollTop = this.messagesContainerEl.scrollHeight;
	}

	appendMessage(msg: ChatMessage) {
		const msgEl = this.messagesContainerEl.createDiv({ cls: `chat-message ${msg.role}` });
		msgEl.style.marginBottom = '15px';
		msgEl.style.padding = '12px';
		msgEl.style.borderRadius = '8px';
		msgEl.style.width = '100%';
		msgEl.style.boxSizing = 'border-box';
		msgEl.style.border = '1px solid var(--background-modifier-border)';
		msgEl.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
		
		if (msg.role === 'tool-progress') {
			msgEl.style.backgroundColor = 'var(--background-secondary)';
			msgEl.style.color = 'var(--text-accent)';
			msgEl.style.fontStyle = 'italic';
			msgEl.setText(`⚙️ ${msg.content}`);
			return;
		}

		if (msg.role === 'tool') {
			msgEl.style.backgroundColor = 'var(--background-primary-alt)';
			msgEl.style.fontSize = '0.9em';
			
			const details = msgEl.createEl('details');
			const summary = details.createEl('summary', { text: `⚙️ Executed tool: ${msg.toolName}` });
			summary.style.cursor = 'pointer';
			summary.style.fontWeight = 'bold';
			summary.style.color = 'var(--text-muted)';
			summary.style.userSelect = 'none';
			
			const pre = details.createEl('pre');
			pre.style.whiteSpace = 'pre-wrap';
			pre.style.wordWrap = 'break-word';
			pre.style.marginTop = '8px';
			pre.style.padding = '8px';
			pre.style.backgroundColor = 'var(--background-secondary)';
			pre.style.borderRadius = '4px';
			pre.createEl('code', { text: msg.content });
			return;
		}

		// Consistent styling for both user and assistant
		msgEl.style.backgroundColor = 'var(--background-secondary)';
		msgEl.style.color = 'var(--text-normal)';
		msgEl.style.alignSelf = 'flex-start';
		msgEl.style.marginLeft = '0';
		
		if (msg.role === 'user') {
			msgEl.style.border = '1px solid var(--interactive-accent)';
			msgEl.style.borderLeft = '4px solid var(--interactive-accent)';
		} else {
			msgEl.style.borderLeft = '4px solid var(--text-muted)';
		}

		msgEl.createEl('strong', { text: msg.role === 'user' ? 'You' : msg.persona, cls: 'message-persona' });
		const contentDiv = msgEl.createEl('div', { cls: 'message-content' });
		contentDiv.style.marginTop = '6px';
		MarkdownRenderer.renderMarkdown(msg.content, contentDiv, '', this).then(() => {
			// Handle file links
			contentDiv.querySelectorAll('a.internal-link').forEach((el) => {
				el.addEventListener('click', async (e) => {
					e.preventDefault();
					const linkText = el.getAttribute('href') || el.textContent;
					if (linkText) {
						await this.plugin.app.workspace.openLinkText(linkText, '', false);
					}
				});
			});

			// Handle JSON forms
			contentDiv.querySelectorAll('code.language-json-form').forEach((el) => {
				const pre = el.parentElement;
				if (!pre) return;
				
				try {
					const formData = JSON.parse(el.textContent || '{}');
					const formContainer = document.createElement('div');
					formContainer.style.border = '1px solid var(--background-modifier-border)';
					formContainer.style.borderRadius = '8px';
					formContainer.style.padding = '15px';
					formContainer.style.marginTop = '10px';
					formContainer.style.backgroundColor = 'var(--background-primary)';

					if (formData.title) {
						const title = formContainer.createEl('h4', { text: formData.title });
						title.style.marginTop = '0';
						title.style.marginBottom = '15px';
					}

					const inputs: { label: string, el: HTMLInputElement | HTMLTextAreaElement }[] = [];

					(formData.fields || []).forEach((field: any) => {
						const fieldContainer = formContainer.createDiv();
						fieldContainer.style.marginBottom = '15px';

						const label = fieldContainer.createEl('strong', { text: field.label });
						label.style.display = 'block';
						label.style.marginBottom = '5px';

						let inputEl: HTMLInputElement | HTMLTextAreaElement;
						if (field.type === 'textarea') {
							inputEl = fieldContainer.createEl('textarea', { placeholder: field.placeholder || '' });
							inputEl.style.resize = 'vertical';
							inputEl.style.minHeight = '60px';
						} else {
							inputEl = fieldContainer.createEl('input', { type: 'text', placeholder: field.placeholder || '' });
						}
						
						inputEl.style.width = '100%';
						inputEl.style.boxSizing = 'border-box';
						inputEl.style.padding = '8px';
						inputEl.style.backgroundColor = 'var(--background-secondary)';
						inputEl.style.border = '1px solid var(--background-modifier-border)';
						inputEl.style.borderRadius = '4px';
						inputEl.style.color = 'var(--text-normal)';

						inputs.push({ label: field.label, el: inputEl });
					});

					const submitBtn = formContainer.createEl('button', { text: 'Submit' });
					submitBtn.style.backgroundColor = 'var(--interactive-accent)';
					submitBtn.style.color = 'var(--text-on-accent)';
					submitBtn.style.border = 'none';
					submitBtn.style.padding = '8px 16px';
					submitBtn.style.borderRadius = '4px';
					submitBtn.style.cursor = 'pointer';

					submitBtn.onclick = async () => {
						let responseText = "";
						inputs.forEach(inp => {
							responseText += `**${inp.label}**\n${inp.el.value || 'N/A'}\n\n`;
						});

						// Remove the json-form from the unified timeline
						if (msg.content) {
							msg.content = msg.content.replace(/```json-form[\s\S]*?```/g, `> *(Form Submitted)*`);
						}

						// Update it in the agentContexts history array to maintain LLM state
						const agentHistory = this.plugin.chatService.getAgentHistory(msg.persona || this.activePersona);
						for (let i = agentHistory.length - 1; i >= 0; i--) {
							const histMsg = agentHistory[i];
							if (histMsg && histMsg.role === 'assistant' && histMsg.content && histMsg.content.includes('```json-form')) {
								histMsg.content = histMsg.content.replace(/```json-form[\s\S]*?```/g, `> *(Form Submitted)*`);
								break;
							}
						}
						
						this.plugin.chatService.persistState();

						formContainer.style.opacity = '0.5';
						submitBtn.disabled = true;

						this.isThinking = true;
						this.renderHistory();
						await this.plugin.chatService.sendMessage(responseText.trim(), this.activePersona);
						this.isThinking = false;
						this.renderHistory();
					};

					pre.replaceWith(formContainer);
				} catch (e) {
					console.error("Failed to parse JSON form", e);
				}
			});
		});
	}

	async onClose() {
		// Cleanup if needed
	}
}
