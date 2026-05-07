import { useEffect, useState } from 'react'
import './App.css'
import type { AgenticContext } from '../../src/core/interfaces/Environment'
import { SandboxFileSystem, SandboxNetwork, SandboxUI, SandboxProcessRunner } from './adapters/SandboxAdapter'
import { DEFAULT_SETTINGS } from '../../src/settings'
import { LoggerService } from '../../src/services/LoggerService'
import { PersonaEngine } from '../../src/core/PersonaEngine'
import { ToolRegistry } from '../../src/sandbox/ToolRegistry'
import { ExecutionSandbox } from '../../src/sandbox/ExecutionSandbox'
import { RoutineManager } from '../../src/core/RoutineManager'
import { ApprovalQueueManager } from '../../src/core/ApprovalQueueManager'
import { McpEngine } from '../../src/core/McpEngine'
import { ChatService } from '../../src/services/ChatService'
import type { ChatMessage } from '../../src/services/ChatService'
import { TriggerParser } from '../../src/core/TriggerParser'
import { App as ObsidianApp } from 'obsidian'
import { SkillsEngine } from '../../src/core/SkillsEngine'

let initialized = false;
let chatService: ChatService | null = null;
let currentContext: AgenticContext | null = null;

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('Initializing Sandbox...');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (initialized) return;
    initialized = true;

    const initEngine = async () => {
      try {
        const settings = { ...DEFAULT_SETTINGS, agenticVaultPath: 'fleets', llmApiKey: 'AIzaSyA25LglHa1-zYILxaW3HVpYHifTBmn9Xls' };
        
        // Setup Context
        const context: AgenticContext = {
          fs: new SandboxFileSystem(),
          network: new SandboxNetwork(),
          ui: new SandboxUI(),
          runner: new SandboxProcessRunner(),
          settings,
          saveSettings: async () => console.log("Mock Save Settings:", settings)
        };

        // Initialize Engines
        const mockApp = new ObsidianApp();
        const logger = new LoggerService(mockApp as any, settings.agenticVaultPath);
        const personaEngine = new PersonaEngine(mockApp as any, settings.agenticVaultPath);
        const toolRegistry = new ToolRegistry(mockApp as any, settings);
        const executionSandbox = new ExecutionSandbox(context, logger, toolRegistry, settings);
        const routineManager = new RoutineManager(mockApp as any, settings.agenticVaultPath);
        const approvalQueue = new ApprovalQueueManager(mockApp as any, settings.agenticVaultPath);
        const mcpEngine = new McpEngine(mockApp as any, settings.agenticVaultPath, settings.customEnvPath);
        const skillsEngine = new SkillsEngine(mockApp as any, settings.agenticVaultPath);
        
        // Mock plugin object for ChatService backward compatibility where not fully decoupled
        const pluginMock: any = {
          settings,
          app: mockApp,
          logger,
          personaEngine,
          toolRegistry,
          executionSandbox,
          routineManager,
          approvalQueue,
          mcpEngine,
          skillsEngine,
          context,
          saveData: async () => {}
        };
        
        const chat = new ChatService(pluginMock);
        pluginMock.chatService = chat;
        chat.onTimelineUpdated = () => {
          setMessages([...chat.unifiedTimeline]);
          setStatus(chat.currentStatus || 'Idle');
          setIsProcessing(chat.isProcessing);
        };
        
        const triggerParser = new TriggerParser(mockApp as any, logger, executionSandbox, routineManager, chat);

        context.logger = logger;
        context.personaEngine = personaEngine;
        context.toolRegistry = toolRegistry;
        context.executionSandbox = executionSandbox;
        context.routineManager = routineManager;
        context.approvalQueue = approvalQueue;
        context.mcpEngine = mcpEngine;
        context.chatService = chat;

        chatService = chat;
        currentContext = context;

        // Load Content
        await personaEngine.loadPersonas();
        await toolRegistry.loadTools();
        await routineManager.initialize();
        await skillsEngine.loadSkills();

        setStatus('Sandbox Ready');
      } catch (err: any) {
        setStatus(`Error initializing sandbox: ${err.message}`);
        console.error(err);
      }
    };

    initEngine();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || !chatService) return;
    const msg = input;
    setInput('');
    try {
      await chatService.sendMessage(msg, 'Concierge');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleInterrupt = () => {
    if (chatService) {
      chatService.abortProcessing();
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <h1>AntiGravity Agentic Sandbox</h1>
      <div style={{ background: '#eee', padding: '10px', marginBottom: '10px', borderRadius: '4px' }}>
        <strong>Status:</strong> {status}
      </div>

      <div style={{ height: '400px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px', marginBottom: '10px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: '15px' }}>
            <strong>{m.persona || m.role}</strong>
            <pre style={{ whiteSpace: 'pre-wrap', background: m.role === 'tool' ? '#f0f0f0' : 'transparent', padding: '5px' }}>
              {m.content}
            </pre>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <input 
          style={{ flex: 1, padding: '10px' }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Send a message to the Concierge..."
          disabled={isProcessing}
        />
        <button onClick={handleSend} disabled={isProcessing || !input.trim()}>Send</button>
        {isProcessing && (
          <button onClick={handleInterrupt} style={{ background: 'red', color: 'white' }}>Interrupt</button>
        )}
      </div>
    </div>
  )
}

export default App
