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
  },
  {
    "name": "present_options",
    "arguments": { 
      "message": "Welcome to 'The Business of You'. The suite is fully installed and your personal board of directors is waiting. To calibrate the system, we need to establish your baseline. How would you like to begin?", 
      "options": [
        "1. Establish my core Identity & Vision (Start Here)",
        "2. Draft my 6-month Strategy & OKRs",
        "3. Clear my immediate tasks & 'fires'",
        "4. Map my critical stakeholders",
        "Bypass (I will explore manually)"
      ],
      "selection_type": "single",
      "allow_custom": false
    }
  }
]
```

### Expected Output
Awaiting user selection...

### Expected File System State
- **Directory Exists:** AgenticVault/fleets/business_of_you/templates
- **Directory Exists:** 10_Strategy
- **Directory Exists:** 20_Execution
