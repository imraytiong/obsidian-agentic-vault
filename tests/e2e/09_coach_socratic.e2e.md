---
name: Coach Socratic Session
description: Tests the Coach reading a journal entry and giving advice.
persona: Coach
assume_installed_fleet: business_of_you
---

### Scenario
**User Input:** Read my latest journal entry about the team conflict and help me process it.

### Expected LLM Tool Calls
```json
[
  {
    "name": "file_manager",
    "arguments": { 
      "action": "read_file",
      "zone_id": "journal",
      "relative_filename": "Team_Conflict.md"
    }
  }
]
```

### Expected Output
Let's talk about the team conflict. What do you think is the root cause?

### Expected File System State
