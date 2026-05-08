---
name: Automatic Template Installation
description: Tests that when a fleet is installed, its bundled templates are successfully synced to the designated templates zone without manual copying.
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
    "arguments": { "zone_id": "templates", "vault_path": "90_Templates", "description": "The repository of dynamic templates owned and iteratively updated by the personas." }
  }
]
```

### Expected Output
The Business of You fleet has been successfully installed, and your templates have been automatically synced to the new templates zone.

### Expected File System State
- **Directory Exists:** 90_Templates
- **File Exists:** 90_Templates/1_on_1_Agenda_Template.md
- **File Exists:** 90_Templates/Project_Brief_Template.md
- **File Exists:** 90_Templates/Daily_Briefing_Template.md
