import type AgenticVaultPlugin from '../main';

export class PromptCompiler {
	static async compileSystemPrompt(plugin: AgenticVaultPlugin, personaName: string): Promise<string> {
		const persona = plugin.personaEngine.getPersonaByName(personaName);
		let systemPrompt = persona ? persona.systemPrompt : 'You are a helpful assistant.';

		const now = new Date();
		systemPrompt += `\n\n[System Context]\nThe current date and time is: ${now.toLocaleString()}.`;

		const zonesStr = Object.entries(plugin.settings.zones)
			.map(([zoneId, zoneDef]) => `- **${zoneId}** -> \`${zoneDef.path}\`: ${zoneDef.description}`)
			.join('\n');
		systemPrompt += `\n\n[Active Semantic Zones]\nThe vault is organized into these authorized zones:\n${zonesStr}\nIf you need to read or write files, ALWAYS use one of these zone IDs in your tools. Do not hallucinate paths outside of these zones.`;

		const sharedMemoryPath = 'AgenticVault/memory/shared_memory.md';
		if (await plugin.app.vault.adapter.exists(sharedMemoryPath)) {
			const sharedMemoryContent = await plugin.app.vault.adapter.read(sharedMemoryPath);
			systemPrompt += `\n\n[Global User Profile (Core Identity)]\n${sharedMemoryContent}`;
		}

		const personaMemoryPath = `AgenticVault/memory/personas/${personaName.toLowerCase().replace(/ /g, '_')}_memory.md`;
		if (await plugin.app.vault.adapter.exists(personaMemoryPath)) {
			const personaMemoryContent = await plugin.app.vault.adapter.read(personaMemoryPath);
			systemPrompt += `\n\n[Persona-Specific Context]\n${personaMemoryContent}`;
		}

		systemPrompt += `\n\n[System Rules]\n- When referring to files in the vault, ALWAYS use Obsidian wiki-link syntax: [[File Name]].\n- When asking the user a structured list of questions, DO NOT ask them in plain text. Instead, output a JSON block tagged with \`\`\`json-form\`\`\` that defines the form. The JSON must follow this exact schema: { "title": "Form Title", "fields": [ { "id": "field_id", "label": "Question Text", "type": "textarea", "placeholder": "Example answer..." } ] }\n- You have access to a permanent memory system via the \`update_memory\` tool. If the user explicitly states a preference, makes a major decision, or reveals a long-term goal, you MUST use the \`update_memory\` tool to permanently record it.\n- Hierarchy of Truth: The [Global User Profile (Core Identity)] block represents the user's current true identity. Vault documents represent Project State. If a Vault document contradicts the Core Identity, the Core Identity takes precedence. You MUST explicitly ask the user if the Vault document needs to be updated to match their new identity.\n- [VERIFICATION RULE]: You are strictly prohibited from confirming a task is complete based solely on your intent. You MUST receive a successful output receipt from a tool before telling the user it is done.`;

		const allPersonas = plugin.personaEngine.getAllPersonas();
		const personaRegistry = allPersonas.map(p => `- **${p.name}**: ${p.description || 'A helpful specialized agent.'}`).join('\n');
		systemPrompt += `\n\n[Available Expert Personas for Handoff]\n${personaRegistry}\nIf you believe another agent is better suited to help the user, use the transfer_session tool to hand them off.`;

		const skills = plugin.skillsEngine.getSkillCatalog();
		if (skills.length > 0) {
			const catalog = skills.map(s => `- **${s.id}** (${s.name}): ${s.description}`).join('\n');
			systemPrompt += `\n\n[Available Skills Catalog]\n${catalog}\nUse the \`load_skill\` tool to read the full instructions for any of these skills if they are relevant to your current task.`;
		}

		return systemPrompt;
	}
}
