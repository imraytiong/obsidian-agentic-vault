# Software Specification: Agentic Vault AI (Obsidian Plugin) - V11

## 1. Project Overview
**Name:** Agentic Vault AI - Headless Runner Extension
**Type:** Node.js Standalone Daemon & Vault File Monitor
**Purpose:** Decouples the Agentic Vault Execution Sandbox and ReAct loop from the Obsidian Desktop App. Allows the vault to be securely operated and updated by an AI agent running on a dedicated background host (e.g., a headless Mac Mini or home server).

## 2. Remote Topologies & Sync Lock

### 2.1 The Headless Runner Service (`sherpa-runner`)
A standalone Node.js daemon that monitors the Vault directory (specifically `AgenticVault/` or Periodic Notes) via file system watchers.
- Detects specific file changes (e.g. `#sherpa-trigger`) pushed via cloud sync.
- Operates entirely independently of the Obsidian desktop application.

### 2.2 Remote Dispatcher & ReAct Loop Port
- Ports the `ChatService` ReAct logic to the Headless Runner.
- Loads the same `LLMProvider` implementations.
- Leverages the `ToolRegistry` to execute tool sandboxes (Node, Docker, Podman).
- Writes execution outputs directly to Markdown files via standard Node `fs` (since the Obsidian `App` context is not available).

### 2.3 Exclusive Sync Lock Mechanism
- A strictly enforced concurrency mechanism using `sync_lock.json`.
- The runner acquires a lock before writing changes to prevent conflicting local user edits.
- The local Obsidian Plugin will display a UI warning if it detects an active lock: *"Agentic Vault is currently modifying the vault remotely. Please wait..."*

## 3. Deployment Flow
1. User commits a trigger to the vault via mobile (Git or Google Drive).
2. The headless daemon running at home detects the sync and reads the trigger.
3. The daemon acquires `sync_lock.json`.
4. The daemon executes the ReAct loop and tool sandboxes.
5. The daemon writes the result back to the note.
6. The daemon releases `sync_lock.json`.
7. The cloud sync pushes the updated note back to the user's mobile device.
