---
name: Comms CRM Outreach
description: Tests the Comms persona using crm_query to generate an email template.
persona: Communications Specialist
assume_installed_fleet: business_of_you
---

### Scenario
**User Input:** Draft a catch-up email for Sarah based on our last interaction.

### Expected LLM Tool Calls
```json
[
  {
    "name": "file_manager",
    "arguments": { 
      "action": "read_file",
      "zone_id": "network",
      "relative_filename": "Sarah.md"
    }
  },
  {
    "name": "file_manager",
    "arguments": {
      "action": "write_file",
      "zone_id": "workspace",
      "relative_filename": "Draft_Email_Sarah.md",
      "content": "Subject: Catching up!\n\nHi Sarah..."
    }
  }
]
```

### Expected Output
I have drafted the email for Sarah in your workspace.

### Expected File System State
- **File Exists:** 99_Agent_Workspace/Draft_Email_Sarah.md
