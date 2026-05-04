import { Notice } from 'obsidian';
import AgenticVaultPlugin from '../main';
import { BlueprintEngine } from '../blueprints/BlueprintEngine';
import { BUNDLED_FLEETS } from '../blueprints/BundledFleets';
import { FleetBlueprint } from '../blueprints/types';

export async function renderOnboarding(contentEl: HTMLElement, plugin: AgenticVaultPlugin, onComplete: () => void) {
	contentEl.style.display = 'block';
	contentEl.style.padding = '20px';
	contentEl.style.overflowY = 'auto';

	contentEl.createEl("h2", { text: "Welcome to Agentic Vault" });
	contentEl.createEl("p", { 
		text: "Agentic Vault uses the PARA method (Projects, Areas, Resources, Archives) to organize your vault. Let's set up your agents and folders."
	});

	const form = contentEl.createDiv();
	form.style.display = 'flex';
	form.style.flexDirection = 'column';
	form.style.gap = '15px';
	form.style.marginTop = '20px';

	// --- 1. LLM CONFIGURATION ---
	form.createEl('h3', { text: '1. Connect Your LLM', cls: 'setting-item-heading' });
	
	const llmSection = form.createDiv();
	llmSection.style.display = 'flex';
	llmSection.style.flexDirection = 'column';
	llmSection.style.gap = '10px';
	llmSection.style.padding = '15px';
	llmSection.style.border = '1px solid var(--background-modifier-border)';
	llmSection.style.borderRadius = '8px';
	llmSection.style.backgroundColor = 'var(--background-secondary)';

	// Provider
	const providerRow = llmSection.createDiv();
	providerRow.createEl('strong', { text: 'LLM Provider' });
	const providerSelect = providerRow.createEl('select');
	providerSelect.style.width = '100%';
	providerSelect.style.marginTop = '5px';
	providerSelect.createEl('option', { value: 'gemini', text: 'Google Gemini (Native)' });
	providerSelect.createEl('option', { value: 'openai', text: 'OpenAI Compatible (Ollama, LM Studio, etc)' });
	providerSelect.value = plugin.settings.llmProvider || 'gemini';
	providerSelect.onchange = async () => {
		plugin.settings.llmProvider = providerSelect.value;
		await plugin.saveSettings();
	};

	// API Key
	const keyRow = llmSection.createDiv();
	keyRow.createEl('strong', { text: 'API Key' });
	const keyInput = keyRow.createEl('input', { type: 'password', placeholder: 'Enter your API key...' });
	keyInput.style.width = '100%';
	keyInput.style.marginTop = '5px';
	keyInput.value = plugin.settings.llmApiKey || '';
	keyInput.onchange = async () => {
		plugin.settings.llmApiKey = keyInput.value;
		await plugin.saveSettings();
	};
	const helperText = keyRow.createEl('div', { text: "Don't have a Gemini key? " }).style.fontSize = '0.85em';
	const link = document.createElement('a');
	link.href = 'https://aistudio.google.com/app/apikey';
	link.textContent = 'Get one here for free.';
	link.target = '_blank';
	keyRow.appendChild(link);

	// Models
	const modelRow = llmSection.createDiv();
	modelRow.createEl('strong', { text: 'Selected Model' });
	const modelSelect = modelRow.createEl('select');
	modelSelect.style.width = '100%';
	modelSelect.style.marginTop = '5px';
	
	const populateModels = () => {
		modelSelect.empty();
		const models = plugin.settings.availableModels || [];
		if (models.length === 0) {
			modelSelect.createEl('option', { value: plugin.settings.llmModel, text: plugin.settings.llmModel });
		} else {
			models.forEach((m: string) => modelSelect.createEl('option', { value: m, text: m }));
		}
		modelSelect.value = plugin.settings.llmModel;
	};
	populateModels();

	modelSelect.onchange = async () => {
		plugin.settings.llmModel = modelSelect.value;
		await plugin.saveSettings();
	};

	// Test Button
	const testBtn = llmSection.createEl('button', { text: 'Test Key & Load Models' });
	testBtn.style.marginTop = '5px';
	testBtn.onclick = async () => {
		testBtn.disabled = true;
		testBtn.textContent = 'Testing...';
		try {
			let models: string[] = [];
			if (plugin.settings.llmProvider === 'openai') {
				const { OpenAIProvider } = await import('../llm/OpenAIProvider');
				models = await OpenAIProvider.fetchAvailableModels(plugin.settings.llmApiKey, plugin.settings.llmBaseUrl);
			} else {
				const { GeminiProvider } = await import('../llm/GeminiProvider');
				models = await GeminiProvider.fetchAvailableModels(plugin.settings.llmApiKey);
			}
			
			plugin.settings.availableModels = models;
			if (!models.includes(plugin.settings.llmModel) && models.length > 0) {
				plugin.settings.llmModel = models[0];
			}
			await plugin.saveSettings();
			new Notice(`Success! Found ${models.length} models.`);
			populateModels();
		} catch (e: any) {
			new Notice(`API Error: ${e.message}`);
		} finally {
			testBtn.disabled = false;
			testBtn.textContent = 'Test Key & Load Models';
		}
	};

	// --- 2. VAULT CONFIGURATION ---
	form.createEl('h3', { text: '2. Vault Structure', cls: 'setting-item-heading' });

	const addSetting = (name: string, desc: string, key: keyof typeof plugin.settings) => {
		const row = form.createDiv();
		row.createEl('strong', { text: name });
		row.createEl('div', { text: desc }).style.fontSize = '0.85em';
		const input = row.createEl('input', { type: 'text' });
		input.value = plugin.settings[key] as string || '';
		input.style.width = '100%';
		input.style.marginTop = '5px';
		input.onchange = async () => {
			// @ts-ignore
			plugin.settings[key] = input.value;
			await plugin.saveSettings();
		};
	};

	addSetting('Root Folder', 'Optional root folder (leave empty for vault root)', 'rootFolder');
	addSetting('Projects', 'Path for active projects.', 'projectsPath');
	addSetting('Areas', 'Path for active areas of responsibility.', 'areasPath');
	addSetting('Resources', 'Path for resources and reference material.', 'resourcesPath');
	addSetting('Archives', 'Path for completed or inactive items.', 'archivesPath');
	addSetting('Agentic Vault OS', 'Path for configuration and personas.', 'agenticVaultPath');

	// --- 3. STARTER FLEETS ---
	form.createEl('h3', { text: '3. Starter Fleets', cls: 'setting-item-heading' });
	form.createEl('p', { text: 'Select which agent fleets to install. You can add more later.', cls: 'setting-item-description' }).style.fontSize = '0.85em';
	
	const fleetSelection: Record<string, boolean> = {};
	
	BUNDLED_FLEETS.forEach(fleet => {
		fleetSelection[fleet.id] = fleet.id === 'core-fleet'; // default check core

		const fleetRow = form.createDiv();
		fleetRow.style.display = 'flex';
		fleetRow.style.alignItems = 'flex-start';
		fleetRow.style.gap = '10px';
		fleetRow.style.marginBottom = '5px';
		
		const checkbox = fleetRow.createEl('input', { type: 'checkbox' });
		checkbox.checked = fleetSelection[fleet.id];
		checkbox.onchange = () => {
			fleetSelection[fleet.id] = checkbox.checked;
		};

		const textDiv = fleetRow.createDiv();
		textDiv.createEl('strong', { text: fleet.name });
		textDiv.createDiv({ text: fleet.description }).style.fontSize = '0.85em';
		textDiv.style.color = 'var(--text-muted)';
	});

	const btn = form.createEl('button', { text: 'Initialize Vault' });
	btn.style.marginTop = '15px';
	btn.style.backgroundColor = 'var(--interactive-accent)';
	btn.style.color = 'var(--text-on-accent)';
	btn.style.cursor = 'pointer';

	btn.onclick = async () => {
		if (!plugin.settings.llmApiKey || plugin.settings.llmApiKey.trim() === '') {
			new Notice('⚠️ Please enter an API key to continue.');
			return;
		}

		btn.disabled = true;
		btn.textContent = 'Initializing...';
		const selectedFleets = BUNDLED_FLEETS.filter(f => fleetSelection[f.id]);
		await initializeVault(plugin, selectedFleets, onComplete);
	};
}

async function initializeVault(plugin: AgenticVaultPlugin, selectedFleets: FleetBlueprint[], onComplete: () => void) {
	const root = plugin.settings.rootFolder ? `${plugin.settings.rootFolder}/` : '';
	
	const paths = [
		`${root}${plugin.settings.projectsPath}`,
		`${root}${plugin.settings.areasPath}`,
		`${root}${plugin.settings.resourcesPath}`,
		`${root}${plugin.settings.archivesPath}`,
		`${root}${plugin.settings.agenticVaultPath}`,
		`${root}${plugin.settings.agenticVaultPath}/personas`,
		`${root}${plugin.settings.agenticVaultPath}/tools`,
		`${root}${plugin.settings.agenticVaultPath}/skills`,
		`${root}${plugin.settings.agenticVaultPath}/routines`
	];

	try {
		for (const p of paths) {
			const path = p.replace(/\/+/g, '/').replace(/\/$/, '');
			if (path && !plugin.app.vault.getAbstractFileByPath(path)) {
				await plugin.app.vault.createFolder(path);
			}
		}
		
		const agenticVaultPath = `${root}${plugin.settings.agenticVaultPath}`.replace(/\/+/g, '/').replace(/\/$/, '');

		const engine = new BlueprintEngine(plugin.app);
		for (const fleet of selectedFleets) {
			await engine.installFleet(fleet, agenticVaultPath);
		}
		
		plugin.settings.hasCompletedOnboarding = true;
		await plugin.saveSettings();
		
		// Give Obsidian's internal metadata cache 500ms to index the newly created TFiles
		// otherwise folder.children in the engines will be empty
		await new Promise(resolve => window.setTimeout(resolve, 500));

		// Force re-initialize all engines to pick up newly scaffolded blueprints
		await plugin.personaEngine.loadPersonas();
		await plugin.toolRegistry.loadTools();
		await plugin.skillsEngine.loadSkills();
		await plugin.mcpEngine.initialize();
		
		new Notice("Agentic Vault initialized!");
		onComplete();
	} catch (e: unknown) {
		new Notice("Error initializing vault folders. See console.");
		console.error(e);
	}
}
