---
name: MCP Network Offline Resilience
description: Tests Phase 5 MCP Offline Degradation Mode.
persona: Concierge
assume_installed_fleet: test_fleet
offline_mode: true
---

### Scenario
**User Input:** Fetch the mock payload.

### Expected LLM Tool Calls
```json
[
  {
    "name": "mock_server___mock_network_tool",
    "arguments": { 
      "delay": 0,
      "fail": false
    }
  }
]
```

### Expected Output
**Tool Error (mock_server___mock_network_tool):** Network Disconnect: Offline mode is enabled.
I apologize, but I am currently in offline mode and cannot fetch the payload.
