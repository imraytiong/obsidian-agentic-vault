---
name: Skill Loading Flow
description: Tests the load_skill core tool.
persona: Concierge
---

### Scenario
**User Input:** Load the project planning skill.

### Expected LLM Tool Calls
```json
[
  {
    "name": "load_skill",
    "arguments": { 
      "skill_id": "project_planning"
    }
  }
]
```

### Expected Output
I have loaded the skill instructions.

### Expected File System State
