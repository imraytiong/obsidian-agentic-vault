import fs from 'fs';

export interface MarkdownTestScenario {
	name: string;
	description: string;
	persona: string;
	assume_installed_fleet?: string;
	offline_mode?: boolean;
	userInput: string;
	expectedToolCalls: unknown[];
	expectedOutput: string;
	expectedDirectories: string[];
	expectedFiles: string[];
	expectedMissingFiles: string[];
	expectedToolErrors: { tool: string, errorContains: string }[];
}

export function parseMarkdownTest(filePath: string): MarkdownTestScenario {
	const content = fs.readFileSync(filePath, 'utf-8');
	
	const scenario: MarkdownTestScenario = {
		name: '',
		description: '',
		persona: '',
		userInput: '',
		expectedToolCalls: [],
		expectedOutput: '',
		expectedDirectories: [],
		expectedFiles: [],
		expectedMissingFiles: [],
		expectedToolErrors: []
	};

	// Parse frontmatter
	const fmMatch = content.match(/---\n([\s\S]*?)\n---/);
	if (fmMatch) {
		const fmLines = fmMatch[1].split('\n');
		for (const line of fmLines) {
			if (line.startsWith('name:')) scenario.name = line.substring(5).trim();
			if (line.startsWith('description:')) scenario.description = line.substring(12).trim();
			if (line.startsWith('persona:')) scenario.persona = line.substring(8).trim();
			if (line.startsWith('assume_installed_fleet:')) scenario.assume_installed_fleet = line.substring(23).trim();
			if (line.startsWith('offline_mode:')) scenario.offline_mode = line.substring(13).trim() === 'true';
		}
	}

	// Parse user input
	const userInputMatch = content.match(/\*\*User Input:\*\*\s*(.*)/);
	if (userInputMatch) scenario.userInput = userInputMatch[1].trim();

	// Parse tool calls
	const toolCallsMatch = content.match(/### Expected LLM Tool Calls\s*```json\n([\s\S]*?)\n```/);
	if (toolCallsMatch) {
		try {
			scenario.expectedToolCalls = JSON.parse(toolCallsMatch[1]);
		} catch (e) {
			console.error(`Failed to parse tool calls JSON in ${filePath}`);
		}
	}

	// Parse expected output
	const outputMatch = content.match(/### Expected Output\s*([\s\S]*?)### Expected File System State/);
	if (outputMatch) {
		scenario.expectedOutput = outputMatch[1].trim();
	} else {
		// If there is no File System State section
		const fallbackOutputMatch = content.match(/### Expected Output\s*([\s\S]*)/);
		if (fallbackOutputMatch) scenario.expectedOutput = fallbackOutputMatch[1].trim();
	}

	// Parse file system expectations
	const fsMatch = content.match(/### Expected File System State\s*([\s\S]*)/);
	if (fsMatch) {
		const lines = fsMatch[1].split('\n');
		for (const line of lines) {
			const dirMatch = line.match(/-\s*\*\*Directory Exists:\*\*\s*(.*)/);
			if (dirMatch) scenario.expectedDirectories.push(dirMatch[1].trim());
			
			const fileMatch = line.match(/-\s*\*\*File Exists:\*\*\s*(.*)/);
			if (fileMatch) scenario.expectedFiles.push(fileMatch[1].trim());

			const missingMatch = line.match(/-\s*\*\*File Missing:\*\*\s*(.*)/);
			if (missingMatch) scenario.expectedMissingFiles.push(missingMatch[1].trim());

			const errMatch = line.match(/-\s*\*\*Tool Error \((.*?)\):\*\*\s*(.*)/);
			if (errMatch) scenario.expectedToolErrors.push({ tool: errMatch[1].trim(), errorContains: errMatch[2].trim() });
		}
	}

	return scenario;
}
