---
name: Manage Tasks Queue
description: Tests the manage_queue tool.
persona: Concierge
assume_installed_fleet: business_of_you
---

### Scenario
**User Input:** Add a task to review the Q3 financials.

### Expected LLM Tool Calls
```json
[
  {
    "name": "manage_queue",
    "arguments": { 
      "action": "append",
      "payload": "Review Q3 financials"
    }
  }
]
```

### Expected Output
I have added the task to your queue.

### Expected File System State
