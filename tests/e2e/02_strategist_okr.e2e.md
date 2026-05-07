---
name: Chief Strategist OKR Generation
description: Tests that the Chief Strategist can generate an OKR using the file_manager tool.
persona: Chief Strategist
assume_installed_fleet: business_of_you
---

### Scenario
**User Input:** Help me define my OKRs for Q3. Focus on launching the new Agentic Vault plugin.

### Expected LLM Tool Calls
```json
[
  {
    "name": "file_manager",
    "arguments": { 
      "action": "write_file", 
      "zone_id": "strategy",
      "relative_filename": "Q3_Agentic_Vault_OKRs.md", 
      "content": "# Q3 OKRs: Agentic Vault\n\n## Objective\nLaunch Agentic Vault Plugin\n\n## Key Results\n1. Write E2E tests\n2. Fix TS errors" 
    }
  }
]
```

### Expected Output
I have created your Q3 OKR document in the Strategy zone.

### Expected File System State
- **File Exists:** 10_Strategy/Q3_Agentic_Vault_OKRs.md
