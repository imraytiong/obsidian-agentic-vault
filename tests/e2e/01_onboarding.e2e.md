---
name: Onboarding The Business of You
description: Tests the end-to-end onboarding flow for the executive suite.
persona: Concierge
---

### Scenario
**User Input:** Install The Business of You (Executive Suite)

### Expected LLM Tool Calls
```json
[
  {
    "name": "install_fleet",
    "arguments": { "fleet_name": "business_of_you" }
  },
  {
    "name": "allocate_zone",
    "arguments": { "zone_id": "strategy", "vault_path": "10_Strategy", "description": "Contains formal OKRs and project briefs." }
  },
  {
    "name": "allocate_zone",
    "arguments": { "zone_id": "execution", "vault_path": "20_Execution", "description": "Contains the tasks.jsonl queue and sprint boards." }
  }
]
```

### Expected Output
The Business of You fleet has been successfully installed

### Expected File System State
- **Directory Exists:** AgenticVault/fleets/business_of_you/templates
- **Directory Exists:** 10_Strategy
- **Directory Exists:** 20_Execution
