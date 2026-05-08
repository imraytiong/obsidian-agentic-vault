---
name: Routine Morning Briefing
description: Tests the manage_routines tool to trigger a background routine.
persona: Chief Operating Officer
assume_installed_fleet: business_of_you
---

### Scenario
**User Input:** Run my morning briefing routine now.

### Expected LLM Tool Calls
```json
[
  {
    "name": "manage_routines",
    "arguments": { 
      "action": "trigger",
      "routine_id": "morning_briefing"
    }
  }
]
```

### Expected Output
I have triggered the morning briefing routine.

### Expected File System State
