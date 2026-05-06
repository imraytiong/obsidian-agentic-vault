---
name: "PARA Career Management"
system_version: 1.0.0
description: "A specialized fleet of executive agents designed to manage projects, tasks, and daily workflows."
status: active
required_zones:
  - zone_id: daily_logs
    vault_path: 10_daily_notes
    description: "Chronological tracking of daily work and reflections."
  - zone_id: inbox
    vault_path: 20_inbox
    description: "Universal entry point for raw, unprocessed notes and ideas."
  - zone_id: active_projects
    vault_path: 30_projects
    description: "Active, ongoing projects with clear endpoints."
  - zone_id: areas_of_responsibility
    vault_path: 40_areas
    description: "Ongoing responsibilities and areas of focus without an end date."
  - zone_id: knowledge_base
    vault_path: 50_resources
    description: "Reference materials, articles, and useful knowledge."
  - zone_id: archives
    vault_path: 60_archives
    description: "Completed projects or inactive resources."
  - zone_id: templates
    vault_path: 80_templates
    description: "Templates used to generate new content."
  - zone_id: agentic_vault
    vault_path: 90_agentic_vault
    description: "The AI system configuration folder."
---