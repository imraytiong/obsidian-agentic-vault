---
name: MCP Network Success
description: Tests Phase 5 MCP Mock Server normal connectivity.
persona: Concierge
assume_installed_fleet: test_fleet
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
I have successfully fetched the mock payload.
