# Software Specification: Agentic Vault AI (Obsidian Plugin) - V10

## 1. Project Overview
**Name:** Agentic Vault AI
**Type:** Obsidian Plugin (TypeScript, Node.js)
**Purpose:** An opinionated Personal Knowledge Management (PKM) plugin leveraging AI to actualize career goals by treating personal career management as a strategized business operation.

## 2. Core Methodology: "The Golden Thread" & Integrated PKM Systems
The vault architecture uses the **PARA Method** and a **Periodic Notes** structure to seamlessly connect long-term Vision and Roadmaps down to Weekly Planning and Daily Execution.

## 3. Key Features & AI Agents
* **The Board of Advisors:** Customizable AI panel for strategic feedback.
* **The Career Mentor:** Always-available RAG-enabled sounding board.
* **The Chief of Staff (CoS):** Operational management utilizing **GTD** principles.
* **Strategic Insight Engine:** Background **Zettelkasten** processing for strategic vectors.
* **Progressive Migration Engine:** Conversational AI auditing for "Brownfield" legacy vaults.

## 4. Agent Architecture: The "Brain" (Skills & Triggers)
Skills are cognitive SOPs stored as Markdown files in `⚙️ System/Skills/`. 

### 4.1 Asynchronous & Scheduled Triggers
Skills can execute autonomously without user prompting via YAML configurations:
* **Time-Based (Cron):** YAML defines a `schedule` and `target_agent`. Ideal for overnight tasks.
* **Event-Based:** YAML defines an `event_name` and `path_match` to trigger agent workflows instantly upon vault changes.

## 5. Agent Architecture: The "Arms & Legs" (Tools & Execution)
* **Standard MCP Registry:** YAML-defined connections to standard servers (e.g., GitHub, Workspace).
* **Execution Sandbox:** Single-file Markdown script execution via an abstracted container engine (e.g., Docker, Podman, or a local Node process). Custom scripts are rapidly scaffolded via the Conductor CLI extension and executed in ephemeral, isolated environments.

## 6. Observability & Deterministic Verification (Closed-Loop Execution)
To prevent LLM hallucinations and ensure verifiable task execution, the framework enforces strict tracing and validation protocols.

### 6.1 The Transparent Audit Trail
* The plugin maintains a persistent, readable log (`Agent_Trace_Log.md` or a UI console) capturing the ReAct (Reasoning and Action) loop of every agent.
* **Tracing Data:** Logs include the injected context, the LLM's internal thought process, the exact JSON payload passed to tools, and the raw standard output/errors from the execution layer.

### 6.2 The "Receipt" Verification System
* Agents are strictly prohibited from reporting a task as "complete" based solely on generation intent.
* **Deterministic Proof:** All tools (MCP or local scripts) must return a deterministic receipt upon success (e.g., a Git commit hash, an API resource ID, or a file modification timestamp).
* **Retry Loops:** If a tool fails or returns an invalid receipt, the orchestration layer intercepts the hallucinated success and forces the agent into an autonomous retry loop before surfacing an error to the user.
* **State Reconciliation:** For internal vault edits, the plugin acts as the final verifier, diffing file states to guarantee the LLM's requested file modifications were physically written to disk.

## 7. Deployment Topology & Vault Synchronization
The execution layer is decoupled from the local UI, supporting background operations.

### 7.1 Execution Modes & Trigger Handling
* **Local Mode:** The plugin uses `child_process` to orchestrate the selected container execution engine (Docker/Podman/Local) and registers cron/event listeners internally (requires Obsidian to be open).
* **Remote Mode:** A lightweight runner service on a remote host (e.g., a headless Mac mini) parses the vault's trigger YAMLs and executes tasks completely independently of the Obsidian app state.

### 7.2 Mutually Exclusive Synchronization
To support Remote Mode without file corruption, the plugin strictly enforces one of two sync methods:
* **Option A: Git Synchronization:** The vault acts as a repo. Triggers force an auto-commit/push/pull lifecycle.
* **Option B: Google Drive Synchronization:** The vault is ambiently managed by the OS Drive client, utilizing micro-delays for cloud propagation.

## 8. Technical Architecture Requirements
* **Framework:** Obsidian Plugin API (TypeScript).
* **Data Storage:** Markdown files structured via PARA. Strict YAML Frontmatter schemas.
* **UI/UX:** Onboarding wizard, and a **Slash Command Router** (`/cos`, `/mentor`) for dynamic autocomplete context switching in the chat UI.
* **Scheduling Engine:** A cron parser and file-watcher service.
* **Observability Engine:** A structured logger bridging the LLM's reasoning loop with the tool execution outputs.

## 9. Development Phases
1. **Phase 1: Scaffolding, Data Structure & Onboarding:** Setup the plugin boilerplate, Onboarding Wizard, and PARA schemas.
2. **Phase 2: UI, Chat, & Slash Routing:** Build the chat interface, LLM connection, and Slash Command Router.
3. **Phase 3: Personas & Skills Engine:** Create dynamic routing by parsing Persona definitions from Markdown files in the `AgenticVault` directory, implement the "Legacy Audit Protocol", and the Asynchronous Trigger parser.
4. **Phase 4: Tool Registry & Execution Sandbox:** Build the MCP client and the abstracted container execution loop (supporting Docker/Podman/Local).
5. **Phase 5: Observability & Verification:** Implement the Agent Audit Log, the Receipt Verification loop, and State Reconciliation diffing.
6. **Phase 6: Insight Engine:** Deploy the CLI scaffolding integration and background Zettelkasten analysis script.
*(Note: Phase 7 Remote Topologies has been officially deferred to V11).*

## 10. AI Developer Handoff & Implementation Guidelines
This section outlines strict constraints for the AI agent executing this build.

* **10.1 Strict Phase Isolation:** The build must proceed linearly. Do not write or suggest code for subsequent phases until the current phase is fully implemented, tested, and approved. 
* **10.2 The Isolated Sandbox:** Initial development and testing must occur in an isolated, dummy vault to prevent accidental file deletion or corruption during state reconciliation diffing. Testing environments should be restricted to a standard development laptop or the headless Mac mini M4 swarm host. The OMEN desktop is strictly ring-fenced for the golf simulator and must never be used for agent deployment or testing.
* **10.3 Native API Prioritization:** For all file system and UI operations, prioritize the official Obsidian API (`app.vault.read()`, `app.metadataCache`, etc.) over standard Node.js `fs` modules to ensure metadata sync integrity. Refer strictly to the `obsidian.d.ts` definitions.
* **10.4 Secret Management:** Ensure `.obsidian/data.json` (where plugin settings and LLM API keys are stored) is rigorously added to the `.gitignore` to prevent secret leakage during Git Synchronization configurations.
* **10.5 The "Echo Tool" Baseline:** When implementing Phase 4 (Execution Sandbox), construct the first local script as a simple "Echo Tool" to validate the entire routing, payload, and stdout capture pipeline before attempting complex operations.

## 11. Appendix: Design Revisions & Changelog
* **Phase 2 UI Redesign (Observability Integration):** Implemented a mandatory `LoggerService` to emit deterministic ReAct trace logs (`Career_Sherpa_Trace_Log.md`) to the root of the vault for real-time AI verification.
* **Phase 2 UI Redesign (Slash Command Autocomplete):** Relocated the "Active Persona" indicator to sit directly above the chat input box. Implemented a smart autocomplete suggestion UI that activates when typing `/` and supports `Tab` completion.
* **Phase 2 UI Redesign (Chat Styling Uniformity):** Removed standard right-alignment and accent-coloring for user messages. Enforced strict left-alignment and uniform `background-secondary` coloring for all chat messages to match the aesthetic of Obsidian's document flow.
* **Phase 3 Dynamic Personas (File-based Configuration):** Refactored the spec so that Personas are no longer hardcoded in TypeScript. They are dynamically loaded from Markdown files stored in a designated `AgenticVault` vault directory. Each Markdown file defines the Persona's name and `/` shortcut command via frontmatter, and its system prompt via the file body.
* **Phase 4 Execution Sandbox Abstraction:** Updated the spec to replace hardcoded "Podman" requirements with an abstracted "Execution Sandbox" layer, allowing the plugin to portably utilize Docker, Podman, or a local Node environment depending on the host system configuration.
* **Phase 6 Insight Engine Restructuring:** Swapped Phase 6 and Phase 7 to prioritize the deployment of local Node.js analytic scripts (`map_vault.md`, `file_manager.md`). The Remote Topologies phase was officially deferred to spec version V11.