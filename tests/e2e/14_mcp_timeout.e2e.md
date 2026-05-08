---
name: MCP Network Timeout Resilience
description: Tests Phase 5 MCP Mock Server connectivity timeout handling.
persona: Concierge
assume_installed_fleet: test_fleet
---

### Scenario
**User Input:** Fetch the mock payload but simulate a timeout.

### Expected LLM Tool Calls
```json
[
  {
    "name": "mock_server___mock_network_tool",
    "arguments": { 
      "delay": 16000,
      "fail": false
    }
  }
]
```

### Expected Output
**Tool Error (mock_server___mock_network_tool):** Timeout Error: The network request took too long and was aborted.
I apologize, but the network request timed out while trying to fetch the payload.
