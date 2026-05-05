import { ItemView, WorkspaceLeaf, MarkdownRenderer, Notice, ButtonComponent } from 'obsidian';
import type AgenticVaultPlugin from '../main';
import { ChatMessage } from '../services/ChatService';
import { Persona } from '../core/PersonaEngine';
import { FleetBlueprint } from '../blueprints/types';

export const VIEW_TYPE_AGENTIC_CHAT = 'agentic-vault-chat-view';

export class AgenticVaultChatView extends ItemView {
	plugin: AgenticVaultPlugin;
	messagesContainerEl!: HTMLElement;
	personaIndicatorEl!: HTMLElement;
	activePersona: string = 'Pager';
	isTimelineMode: boolean = true; // false = Agentic View
	activeTab: 'chat' | 'approvals' = 'chat';

	constructor(leaf: WorkspaceLeaf, plugin: AgenticVaultPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_AGENTIC_CHAT;
	}

	getDisplayText(): string {
		return 'Agentic Vault Chat';
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('agentic-vault-chat-container');

		if (!this.plugin.settings.llmApiKey) {
			this.renderApiGateway(contentEl);
			return;
		}
		
		this.renderChatInterface(contentEl);
	}

	renderApiGateway(contentEl: HTMLElement) {
		contentEl.empty();
		const container = contentEl.createDiv({ attr: { style: 'padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center;' } });
		
		container.createEl('h2', { text: 'Welcome to Agentic Vault' });
		container.createEl('p', { text: 'To wake up the system and initialize your Concierge, please provide your LLM API key.', attr: { style: 'color: var(--text-muted); margin-bottom: 20px;' } });
		
		const providerSelect = container.createEl('select', { attr: { style: 'margin-bottom: 15px; padding: 5px; width: 100%; max-width: 300px;' } });
		['gemini', 'openai', 'anthropic', 'openrouter'].forEach(p => {
			providerSelect.createEl('option', { value: p, text: p.charAt(0).toUpperCase() + p.slice(1) });
		});
		providerSelect.value = 'gemini'; // default

		const input = container.createEl('input', { type: 'password', placeholder: 'Enter API Key...', attr: { style: 'margin-bottom: 10px; padding: 10px; width: 100%; max-width: 300px;' } });
		
		const modelSelect = container.createEl('select', { attr: { style: 'margin-bottom: 5px; padding: 5px; width: 100%; max-width: 300px; display: none;' } });
		const statusText = container.createEl('p', { text: '', attr: { style: 'color: var(--text-muted); margin-bottom: 20px; font-size: 0.85em; display: none; height: 15px;' } });

		let fetchTimeout: any = null;
		input.addEventListener('input', () => {
			if (fetchTimeout) clearTimeout(fetchTimeout);
			fetchTimeout = setTimeout(async () => {
				const apiKey = input.value.trim();
				if (apiKey.length < 5) {
					modelSelect.style.display = 'none';
					statusText.style.display = 'none';
					return;
				}
				
				statusText.style.display = 'block';
				statusText.style.color = 'var(--text-muted)';
				statusText.setText('Testing connection and fetching models...');
				try {
					let models: string[] = [];
					if (providerSelect.value === 'openai') {
						const { OpenAIProvider } = await import('../llm/OpenAIProvider');
						models = await OpenAIProvider.fetchAvailableModels(apiKey, this.plugin.settings.llmBaseUrl);
					} else {
						const { GeminiProvider } = await import('../llm/GeminiProvider');
						models = await GeminiProvider.fetchAvailableModels(apiKey);
					}
					
					this.plugin.settings.availableModels = models;
					
					if (models.length > 0) {
						modelSelect.empty();
						models.forEach(m => modelSelect.createEl('option', { value: m, text: m }));
						
						const getBestModel = (models: string[]) => {
							return [...models].sort((a, b) => {
								const getV = (str: string) => parseFloat(str.match(/[\d]+(?:\.[\d]+)?/)?.[0] || '0');
								const vA = getV(a); const vB = getV(b);
								if (vA !== vB) return vB - vA;
								
								const tierWeight = (m: string) => {
									const lower = m.toLowerCase();
									if (lower.includes('pro') || lower.includes('plus') || lower.includes('opus') || lower.includes('gpt-4o') || lower.includes('o1') || lower.includes('o3')) return 3;
									if (lower.includes('flash') || lower.includes('sonnet') || lower.includes('turbo')) return 2;
									if (lower.includes('haiku') || lower.includes('mini')) return 1;
									return 0;
								};
								const wA = tierWeight(a); const wB = tierWeight(b);
								if (wA !== wB) return wB - wA;
								
								const isExpA = a.toLowerCase().includes('exp') || a.toLowerCase().includes('preview');
								const isExpB = b.toLowerCase().includes('exp') || b.toLowerCase().includes('preview');
								if (isExpA !== isExpB) return isExpA ? 1 : -1;
								
								return a.length - b.length;
							})[0] || models[0];
						};
						
						const best = getBestModel(models);
						this.plugin.settings.llmModel = best;
						modelSelect.value = best;
						modelSelect.style.display = 'block';
						statusText.style.color = 'var(--text-success)';
						statusText.setText(`Found ${models.length} models. Auto-selected best.`);
					} else {
						statusText.style.color = 'var(--text-error)';
						statusText.setText('No compatible models found.');
					}
				} catch (e: any) {
					statusText.style.color = 'var(--text-error)';
					statusText.setText(`API Error: ${e.message}`);
					modelSelect.style.display = 'none';
				}
			}, 1000);
		});

		providerSelect.addEventListener('change', () => {
			input.dispatchEvent(new Event('input'));
		});
		
		modelSelect.addEventListener('change', () => {
			this.plugin.settings.llmModel = modelSelect.value;
		});

		container.createEl('p', { text: 'Installation Folder:', attr: { style: 'color: var(--text-muted); margin-bottom: 5px; font-size: 0.9em;' } });
		const folderInput = container.createEl('input', { type: 'text', value: 'agentic_vault', placeholder: 'Installation Folder...', attr: { style: 'margin-bottom: 20px; padding: 10px; width: 100%; max-width: 300px;' } });
		
		const saveBtn = new ButtonComponent(container)
			.setButtonText('Save & Wake Up')
			.setCta()
			.onClick(async () => {
				const key = input.value.trim();
				const folderName = folderInput.value.trim();
				if (!key) {
					new Notice('API Key is required.');
					return;
				}
				if (!folderName) {
					new Notice('Installation folder is required.');
					return;
				}
				
				this.plugin.settings.llmProvider = providerSelect.value as any;
				this.plugin.settings.llmApiKey = key;
				this.plugin.settings.agenticVaultPath = folderName;
				// llmModel is automatically saved when modelSelect changes
				await this.plugin.saveSettings();
				
				// Initialize the directories now that the user has opted in
				await this.plugin.initializeFleetArchitecture();
				
				contentEl.empty();
				this.renderChatInterface(contentEl);
				
				// Set active persona to Concierge
				this.activePersona = 'Concierge';
				if (this.personaIndicatorEl) {
					this.personaIndicatorEl.setText(`Agent: ${this.activePersona}`);
				}

				// Trigger Concierge intro
				this.plugin.chatService.sendMessage(
					"The user has just connected the API for the first time. Introduce yourself and begin the interactive onboarding sequence.",
					"Concierge",
					"System"
				);
			});
	}

	renderChatInterface(contentEl: HTMLElement) {
		contentEl.style.display = 'flex';
		contentEl.style.flexDirection = 'column';
		contentEl.style.height = '100%';

		const tabBar = contentEl.createDiv({ cls: 'chat-tab-bar' });
		tabBar.style.display = 'flex';
		tabBar.style.borderBottom = '1px solid var(--background-modifier-border)';
		tabBar.style.marginBottom = '10px';
		tabBar.style.flexShrink = '0';

		const chatTab = tabBar.createEl('button', { text: 'Chat' });
		const approvalsTab = tabBar.createEl('button');
		
		const updateTabStyles = () => {
			const activeStyle = 'border-bottom: 2px solid var(--interactive-accent); color: var(--text-normal); background: transparent; border-top: none; border-left: none; border-right: none; box-shadow: none; border-radius: 0; padding: 5px 15px; font-weight: bold; cursor: pointer;';
			const inactiveStyle = 'border-bottom: 2px solid transparent; color: var(--text-muted); background: transparent; border-top: none; border-left: none; border-right: none; box-shadow: none; border-radius: 0; padding: 5px 15px; cursor: pointer;';
			chatTab.setAttribute('style', this.activeTab === 'chat' ? activeStyle : inactiveStyle);
			approvalsTab.setAttribute('style', this.activeTab === 'approvals' ? activeStyle : inactiveStyle);
			
			const pendingCount = this.plugin.approvalQueue.getPendingRequests().length;
			approvalsTab.setText(pendingCount > 0 ? `Approvals (${pendingCount})` : 'Approvals');
		};

		const contentContainer = contentEl.createDiv({ cls: 'chat-tab-content' });
		contentContainer.style.display = 'flex';
		contentContainer.style.flexDirection = 'column';
		contentContainer.style.flexGrow = '1';
		contentContainer.style.overflow = 'hidden';

		chatTab.onclick = () => {
			this.activeTab = 'chat';
			updateTabStyles();
			contentContainer.empty();
			this.renderChatTab(contentContainer);
		};

		approvalsTab.onclick = () => {
			this.activeTab = 'approvals';
			updateTabStyles();
			contentContainer.empty();
			this.renderApprovalsTab(contentContainer);
		};

		updateTabStyles();
		if (this.activeTab === 'chat') {
			this.renderChatTab(contentContainer);
		} else {
			this.renderApprovalsTab(contentContainer);
		}
		
		this.registerEvent(
			this.plugin.app.vault.on('modify', (file) => {
				const vaultPath = this.plugin.settings.agenticVaultPath;
				if (file.path.endsWith('logs/approval_queue.json')) {
					updateTabStyles();
					if (this.activeTab === 'approvals') {
						contentContainer.empty();
						this.renderApprovalsTab(contentContainer);
					}
				}
			})
		);
	}

	renderApprovalsTab(contentEl: HTMLElement) {
		contentEl.style.overflowY = 'auto';
		const pendingRequests = this.plugin.approvalQueue.getPendingRequests();
		
		if (pendingRequests.length === 0) {
			contentEl.createEl("p", { text: "No pending actions require human approval at this time.", cls: "text-muted" });
		} else {
			const reqList = contentEl.createDiv('approval-list');
			reqList.style.display = 'flex';
			reqList.style.flexDirection = 'column';
			reqList.style.gap = '1rem';
			
			for (const req of pendingRequests) {
				const card = reqList.createDiv('approval-card');
				card.style.border = '1px solid var(--background-modifier-border)';
				card.style.padding = '15px';
				card.style.borderRadius = '8px';
				card.style.backgroundColor = 'var(--background-primary-alt)';
				
				card.createEl("h4", { text: `[${req.persona}] requests permission:`, attr: { style: 'margin-top: 0; color: var(--text-accent);' } });
				card.createEl("p", { text: req.summary, attr: { style: 'font-weight: bold; margin-bottom: 5px;' } });
				card.createEl("p", { text: `Reason: ${req.reason}`, attr: { style: 'margin-top: 0; font-size: 0.9em;' } });
				card.createEl("small", { text: `Requested: ${new Date(req.timestamp).toLocaleString()}`, cls: "text-muted" });
				
				const btnContainer = card.createDiv('approval-buttons');
				btnContainer.style.display = 'flex';
				btnContainer.style.gap = '10px';
				btnContainer.style.marginTop = '15px';
				
				const approveBtn = new ButtonComponent(btnContainer)
					.setButtonText("Approve & Resume")
					.setCta()
					.onClick(async () => {
						approveBtn.setDisabled(true);
						await this.plugin.approvalQueue.resolveRequest(req.id, 'approved');
						new Notice(`Approved action for ${req.persona}. Agent is resuming...`);
						await this.plugin.chatService.sendMessage("Approval GRANTED. You may proceed with the proposed action.", req.persona);
						contentEl.empty();
						this.renderApprovalsTab(contentEl);
					});
					
				const rejectBtn = new ButtonComponent(btnContainer)
					.setButtonText("Reject")
					.onClick(async () => {
						rejectBtn.setDisabled(true);
						await this.plugin.approvalQueue.resolveRequest(req.id, 'rejected');
						new Notice(`Rejected action for ${req.persona}.`);
						await this.plugin.chatService.sendMessage("Approval REJECTED. Do NOT proceed. You must rethink your approach or stop the task.", req.persona);
						contentEl.empty();
						this.renderApprovalsTab(contentEl);
					});
			}
		}
	}

	renderChatTab(contentEl: HTMLElement) {
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
		inputEl.style.padding = '8px 70px 8px 8px';
		inputEl.style.borderRadius = '5px';
		inputEl.style.border = '1px solid var(--background-modifier-border)';
		inputEl.style.backgroundColor = 'var(--background-primary)';
		inputEl.style.color = 'var(--text-normal)';

		inputEl.addEventListener('input', () => {
			inputEl.style.height = 'auto';
			inputEl.style.height = `${inputEl.scrollHeight}px`;
		});

		const btnContainer = inputRow.createDiv();
		btnContainer.style.position = 'absolute';
		btnContainer.style.right = '5px';
		btnContainer.style.bottom = '5px';
		btnContainer.style.display = 'flex';
		btnContainer.style.gap = '2px';

		const bgSendBtn = btnContainer.createEl('button');
		bgSendBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cloud-upload"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>`;
		bgSendBtn.title = "Send to Background (Cmd/Ctrl + Shift + Enter)";
		bgSendBtn.style.padding = '6px';
		bgSendBtn.style.display = 'flex';
		bgSendBtn.style.alignItems = 'center';
		bgSendBtn.style.justifyContent = 'center';
		bgSendBtn.style.backgroundColor = 'transparent';
		bgSendBtn.style.color = 'var(--text-muted)';
		bgSendBtn.style.border = 'none';
		bgSendBtn.style.cursor = 'pointer';
		bgSendBtn.style.borderRadius = '5px';
		bgSendBtn.addEventListener('mouseenter', () => bgSendBtn.style.color = 'var(--interactive-accent)');
		bgSendBtn.addEventListener('mouseleave', () => bgSendBtn.style.color = 'var(--text-muted)');

		const sendBtn = btnContainer.createEl('button');
		sendBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
		sendBtn.title = "Send (Enter)";
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
			if (this.activeTab === 'chat') {
				this.renderHistory();
			}
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

			if (e.key === 'Enter') {
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
				
				if (e.shiftKey && (e.metaKey || e.ctrlKey)) {
					e.preventDefault();
					handleSend(true);
				} else if (!e.shiftKey) {
					e.preventDefault(); // Prevent default newline insertion
					handleSend(false);
				}
			}
		});

		const handleSend = async (isBackground: boolean = false) => {
			if (!isBackground && this.plugin.chatService.isProcessing) {
				new Notice("Agentic Vault is currently processing a foreground task. Please wait or stop the task.");
				return;
			}
			
			const text = inputEl.value.trim();
			if (!text) return;
			
			if (!this.plugin.settings.llmApiKey || this.plugin.settings.llmApiKey.trim() === '') {
				this.plugin.chatService.unifiedTimeline.push({ role: 'assistant', content: '⚠️ **Missing API Key:** You must configure an API key before chatting. Please go to **Settings → Community plugins → Agentic Vault** to set it up.', persona: 'System' });
				this.renderHistory();
				return;
			}
			
			if (!this.plugin.settings.llmModel || this.plugin.settings.llmModel.trim() === '') {
				this.plugin.chatService.unifiedTimeline.push({ role: 'assistant', content: '⚠️ **Missing LLM Model:** You must select a model before chatting. Please go to **Settings → Community plugins → Agentic Vault** to set it up.', persona: 'System' });
				this.renderHistory();
				return;
			}
			
			this.plugin.logger.log('USER_MESSAGE_SUBMITTED', { text, persona: this.activePersona, isBackground });
			
			inputEl.value = '';
			inputEl.style.height = 'auto'; // Reset height after sending

			if (isBackground) {
				const taskId = `adhoc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
				this.plugin.routineManager.getTasks().push({
					id: taskId,
					routineId: 'Ad-Hoc Background Chat',
					routineName: 'Ad-Hoc Background Chat',
					status: 'running',
					spawnTime: Date.now(),
					attempts: 0
				});
				
				const userMsg = `> ☁️ **[Sent to Background: "${text.length > 50 ? text.substring(0, 50) + '...' : text}"]**`;
				this.plugin.chatService.unifiedTimeline.push({ role: 'user', content: userMsg, persona: 'System' });
				this.renderHistory();
				
				// Fire and forget
				this.plugin.chatService.sendMessage(text, this.activePersona, undefined, taskId).catch(e => {
					console.error("Background Chat error:", e);
					this.plugin.chatService.unifiedTimeline.push({ role: 'assistant', content: `⚠️ **[Background Spawn Failed]**\n\n${e.message}`, persona: 'System' });
					this.renderHistory();
				});
				
				return;
			}

			inputEl.disabled = true;
			sendBtn.disabled = true;
			bgSendBtn.disabled = true;

			// Send to service (synchronously adds user message to timeline)
			try {
				const sendPromise = this.plugin.chatService.sendMessage(text, this.activePersona);
				await sendPromise;
			} catch (e: any) {
				console.error("Chat error:", e);
				new Notice(e.message || "An error occurred during chat processing.");
			} finally {
				inputEl.disabled = false;
				sendBtn.disabled = false;
				bgSendBtn.disabled = false;
				inputEl.focus();
			}
		};

		sendBtn.addEventListener('click', () => handleSend(false));
		bgSendBtn.addEventListener('click', () => handleSend(true));
	}

	renderHistory() {
		this.messagesContainerEl.empty();
		for (const msg of this.plugin.chatService.unifiedTimeline) {
			this.appendMessage(msg);
		}
		
		if (this.plugin.chatService.isProcessing) {
			const msgEl = this.messagesContainerEl.createDiv({ cls: `chat-message thinking` });
			msgEl.style.marginBottom = '15px';
			msgEl.style.padding = '12px';
			msgEl.style.borderRadius = '8px';
			msgEl.style.border = '1px solid var(--background-modifier-border)';
			msgEl.style.backgroundColor = 'var(--background-secondary)';
			msgEl.style.color = 'var(--text-muted)';
			msgEl.style.fontStyle = 'italic';
			msgEl.style.opacity = '0.8';
			msgEl.style.display = 'flex';
			msgEl.style.alignItems = 'center';
			msgEl.style.gap = '10px';
			
			const spinner = msgEl.createDiv();
			spinner.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><style>.spinner_P7sC{transform-origin:center;animation:spinner_svv2 .75s infinite linear}@keyframes spinner_svv2{100%{transform:rotate(360deg)}}</style><path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z" class="spinner_P7sC"/></svg>`;
			spinner.style.display = 'flex';
			
			const statusText = this.plugin.chatService.currentStatus || `${this.activePersona} is thinking...`;
			msgEl.createSpan({ text: statusText });
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
		
		let initiatedBySystem = false;
		if (msg.role === 'assistant') {
			for (let j = this.plugin.chatService.unifiedTimeline.indexOf(msg); j >= 0; j--) {
				const prevMsg = this.plugin.chatService.unifiedTimeline[j];
				if (prevMsg.role === 'user') {
					if (prevMsg.persona === 'System') initiatedBySystem = true;
					break;
				}
			}
		}
		
		if (msg.role === 'user') {
			if (msg.persona === 'System') {
				msgEl.style.border = '1px dashed var(--text-muted)';
				msgEl.style.borderLeft = '4px solid var(--text-muted)';
				msgEl.createEl('strong', { text: '⚙️ System Trigger', cls: 'message-persona', attr: { style: 'color: var(--text-muted); font-style: italic;' } });
			} else {
				msgEl.style.border = '1px solid var(--interactive-accent)';
				msgEl.style.borderLeft = '4px solid var(--interactive-accent)';
				msgEl.createEl('strong', { text: 'You', cls: 'message-persona' });
			}
		} else {
			msgEl.style.borderLeft = '4px solid var(--text-muted)';
			const headerDiv = msgEl.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center;' } });
			headerDiv.createEl('strong', { text: msg.persona, cls: 'message-persona' });
			if (initiatedBySystem) {
				const badge = headerDiv.createSpan({ text: '⚙️ Routine', attr: { title: 'Executing as part of an automated routine' } });
				badge.style.fontSize = '0.75em';
				badge.style.backgroundColor = 'var(--background-modifier-border)';
				badge.style.padding = '2px 6px';
				badge.style.borderRadius = '12px';
				badge.style.color = 'var(--text-muted)';
			}
		}

		const contentDiv = msgEl.createEl('div', { cls: 'message-content' });
		contentDiv.style.marginTop = '6px';
		if (msg.role === 'user' && msg.persona === 'System') {
			contentDiv.style.color = 'var(--text-muted)';
			contentDiv.style.fontStyle = 'italic';
		}

		// Action buttons
		const actionsDiv = msgEl.createEl('div', { cls: 'message-actions' });
		actionsDiv.style.display = 'flex';
		actionsDiv.style.justifyContent = 'flex-end';
		actionsDiv.style.gap = '8px';
		actionsDiv.style.marginTop = '8px';
		actionsDiv.style.borderTop = '1px solid var(--background-modifier-border)';
		actionsDiv.style.paddingTop = '8px';
		actionsDiv.style.opacity = '0.6';

		if (msg.role === 'user') {
			const resendBtn = actionsDiv.createEl('button', { text: '🔄 Resend' });
			resendBtn.style.padding = '4px 8px';
			resendBtn.style.fontSize = '0.8em';
			resendBtn.style.cursor = 'pointer';
			resendBtn.style.backgroundColor = 'transparent';
			resendBtn.style.boxShadow = 'none';
			resendBtn.onclick = () => {
				const inputEl = this.containerEl.querySelector('textarea.chat-input') as HTMLTextAreaElement;
				if (inputEl) {
					inputEl.value = msg.content;
					inputEl.focus();
				}
			};
		}

		if (msg.role === 'assistant' && msg === this.plugin.chatService.unifiedTimeline[this.plugin.chatService.unifiedTimeline.length - 1] && this.plugin.chatService.isProcessing) {
			const stopBtn = actionsDiv.createEl('button', { text: '⏹ Stop' });
			stopBtn.style.padding = '4px 8px';
			stopBtn.style.fontSize = '0.8em';
			stopBtn.style.cursor = 'pointer';
			stopBtn.style.backgroundColor = 'var(--color-red)';
			stopBtn.style.color = 'white';
			stopBtn.style.border = 'none';
			stopBtn.onclick = () => {
				this.plugin.chatService.abortProcessing();
				stopBtn.setText('Stopped');
				stopBtn.disabled = true;
			};
		}

		const copyBtn = actionsDiv.createEl('button', { text: '📋 Copy' });
		copyBtn.style.padding = '4px 8px';
		copyBtn.style.fontSize = '0.8em';
		copyBtn.style.cursor = 'pointer';
		copyBtn.style.backgroundColor = 'transparent';
		copyBtn.style.boxShadow = 'none';
		copyBtn.onclick = async () => {
			await navigator.clipboard.writeText(msg.content);
			copyBtn.setText('✅ Copied!');
			setTimeout(() => copyBtn.setText('📋 Copy'), 2000);
		};

		const debugBtn = actionsDiv.createEl('button', { text: '🐞 Debug' });
		debugBtn.style.padding = '4px 8px';
		debugBtn.style.fontSize = '0.8em';
		debugBtn.style.cursor = 'pointer';
		debugBtn.style.backgroundColor = 'transparent';
		debugBtn.style.boxShadow = 'none';
		debugBtn.onclick = async () => {
			const safeSettings = { ...this.plugin.settings };
			safeSettings.llmApiKey = 'HIDDEN';
			const dump = {
				timestamp: new Date().toISOString(),
				messageRole: msg.role,
				messagePersona: msg.persona,
				routinesInMemory: this.plugin.routineManager.getRoutines().length,
				routinePathsDebug: `${this.plugin.settings.rootFolder ? this.plugin.settings.rootFolder + '/' : ''}${this.plugin.settings.agenticVaultPath}/routines`.replace(/\/+/g, '/'),
				routinesFolderExists: !!this.plugin.app.vault.getAbstractFileByPath(`${this.plugin.settings.rootFolder ? this.plugin.settings.rootFolder + '/' : ''}${this.plugin.settings.agenticVaultPath}/routines`.replace(/\/+/g, '/')),
				tasksInQueue: this.plugin.routineManager.getTasks().length,
				personasLoaded: this.plugin.personaEngine.getAllPersonas().length,
				toolsLoaded: this.plugin.toolRegistry.getAllTools().length,
				settings: safeSettings,
				timelineLength: this.plugin.chatService.unifiedTimeline.length,
				timelineSummary: this.plugin.chatService.unifiedTimeline.map(m => `[${m.role}] ${m.content.substring(0, 100).replace(/\n/g, ' ')}...`)
			};
			
			const dumpStr = JSON.stringify(dump, null, 2);
			const timestamp = new Date().getTime();
			const debugDirPath = `${this.plugin.settings.rootFolder ? this.plugin.settings.rootFolder + '/' : ''}${this.plugin.settings.agenticVaultPath}/logs/debug`.replace(/\/+/g, '/');
			
			try {
				if (!this.plugin.app.vault.getAbstractFileByPath(debugDirPath)) {
					await this.plugin.app.vault.createFolder(debugDirPath);
				}
				const filename = `debug_dump_${timestamp}.json`;
				const filepath = `${debugDirPath}/${filename}`;
				await this.plugin.app.vault.create(filepath, dumpStr);
				
				const clipboardMsg = `Debug dump saved to: ${filepath}\nContext: Dumped at message index ${this.plugin.chatService.unifiedTimeline.indexOf(msg)} from ${msg.persona || 'user'}`;
				await navigator.clipboard.writeText(clipboardMsg);
				debugBtn.setText('✅ Dumped!');
			} catch (e) {
				console.error("Failed to write debug dump", e);
				debugBtn.setText('❌ Error');
			}
			
			setTimeout(() => debugBtn.setText('🐞 Debug'), 2000);
		};

		MarkdownRenderer.renderMarkdown(msg.content, contentDiv, '', this).then(() => {
			// Handle custom multiple choice option syntax: [Option: Some Text]
			const walk = document.createTreeWalker(contentDiv, NodeFilter.SHOW_TEXT, null);
			let node;
			const nodesToReplace = [];
			while ((node = walk.nextNode())) {
				if (node.nodeValue && node.nodeValue.includes('[Option:')) {
					nodesToReplace.push(node);
				}
			}
			nodesToReplace.forEach(n => {
				const parent = n.parentNode;
				if (!parent) return;
				const text = n.nodeValue || '';
				const regex = /\[Option:\s*([^\]]+)\]/g;
				let lastIndex = 0;
				let match;
				const fragment = document.createDocumentFragment();
				
				while ((match = regex.exec(text)) !== null) {
					if (match.index > lastIndex) {
						fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
					}
					
					const btnText = match[1].trim();
					const btn = document.createElement('button');
					btn.className = 'chat-action-btn';
					btn.textContent = btnText;
					btn.style.margin = '4px';
					btn.style.padding = '6px 12px';
					btn.style.borderRadius = '16px';
					btn.style.backgroundColor = 'var(--interactive-accent)';
					btn.style.color = 'var(--text-on-accent)';
					btn.style.border = 'none';
					btn.style.cursor = 'pointer';
					btn.style.fontSize = '0.9em';
					
					btn.onclick = () => {
						const inputEl = this.containerEl.querySelector('textarea.chat-input') as HTMLTextAreaElement;
						if (inputEl) {
							inputEl.value = btnText;
							inputEl.dispatchEvent(new Event('input'));
							inputEl.focus();
							
							const enterEvent = new KeyboardEvent('keydown', {
								key: 'Enter',
								code: 'Enter',
								bubbles: true
							});
							inputEl.dispatchEvent(enterEvent);
						}
					};
					
					fragment.appendChild(btn);
					lastIndex = regex.lastIndex;
				}
				
				if (lastIndex < text.length) {
					fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
				}
				
				if (fragment.childNodes.length > 0) {
					parent.replaceChild(fragment, n);
				}
			});

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

						const submitBtn = this.containerEl.querySelector('.chat-submit-btn') as HTMLButtonElement;
						submitBtn.disabled = true;

						try {
							await this.plugin.chatService.sendMessage(responseText.trim(), this.activePersona);
						} catch (error) {
							console.error(error);
						} finally {
							submitBtn.disabled = false;
						}
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
