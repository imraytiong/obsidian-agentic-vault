---
name: Chief Quality Officer Sprint Review
description: Tests that the Chief Quality Officer analyzes the execution zone.
persona: Chief Quality Officer
assume_installed_fleet: business_of_you
---

### Scenario
**User Input:** Please analyze my execution zone for the current sprint and write a deviation report.

### Expected LLM Tool Calls
```json
[
  {
    "name": "file_manager",
    "arguments": { 
      "action": "read_file", 
      "zone_id": "execution",
      "relative_filename": "tasks.jsonl" 
    }
  },
  {
    "name": "file_manager",
    "arguments": { 
      "action": "write_file", 
      "zone_id": "execution",
      "relative_filename": "Sprint_Deviation_Report.md",
      "content": "# Sprint Deviation Report\nNo critical deviations found."
    }
  }
]
```

### Expected Output
The deviation report has been generated.

### Expected File System State
- **File Exists:** 20_Execution/Sprint_Deviation_Report.md
