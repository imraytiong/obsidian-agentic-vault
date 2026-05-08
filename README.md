# Obsidian Agentic Vault

**Agentic Vault** is an opinionated PKM (Personal Knowledge Management) plugin that allows you to run a team of AI agents directly inside your Obsidian vault. It transforms your vault from a static knowledge base into a living workspace where specialized AI personas can autonomously parse, organize, and interact with your notes.

## Features
- **Multi-Agent Architecture**: Configure different personas (e.g., Researcher, Editor, Manager) with unique system prompts and capabilities.
- **Autonomous Tool Execution**: Agents can securely execute registered tools to read files, search the web, and modify vault contents.
- **MCP Tool Integration**: Connect to local Model Context Protocol servers to securely interact with local applications and remote APIs (e.g., Google Workspace). Includes robust offline mode and connection resiliency.
- **Dynamic Context Routing**: A built-in "Pager" agent automatically routes tasks and queries to the most appropriate specialized agent based on context.
- **"The Business of You" Suite**: A pre-bundled fleet of agents (Concierge, Executive Coach, Chief Strategist) designed to manage your career like a business, featuring automated onboarding and zone-based memory.

## Installation

### Manual Installation
1. Go to the [Releases](https://github.com/imraytiong/obsidian-agentic-vault/releases) page of this repository.
2. Download the `main.js`, `manifest.json`, and `styles.css` from the latest release.
3. Place them inside your vault's `.obsidian/plugins/obsidian-agentic-vault/` directory.
4. Reload Obsidian and enable **Agentic Vault AI** in Settings > Community Plugins.

## Usage
1. Once enabled, open the **Agentic Vault** settings tab to configure your LLM provider (e.g., Gemini, OpenAI) and add your API keys.
2. The plugin will create an `AgenticVault/` folder in your vault containing default personas, tools, and logs.
3. Open the Agent Chat View to start interacting with your agents.

## Development & Building
To build this plugin locally:
```bash
npm install
npm run dev
```

## License
[MIT License](LICENSE)
