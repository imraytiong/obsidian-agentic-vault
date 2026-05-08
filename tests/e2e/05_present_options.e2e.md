---
name: Present Options Flow
description: Tests the UI present_options tool.
persona: Concierge
---

### Scenario
**User Input:** I want to start a new project.

### Expected LLM Tool Calls
```json
[
  {
    "name": "present_options",
    "arguments": { 
      "options": ["Software Engineering", "Marketing Campaign", "Personal Goal"],
      "selection_type": "single"
    }
  }
]
```

### Expected Output

### Expected File System State
