---
name: "The Business of You"
system_version: 0.0.1
description: "A suite of agents to help you manage your professional career or job like a business."
status: active
onboarding_guide: |
  Welcome to "The Business of You". 
  
  **Recommendation:** Progressively work through this system. Don't try to dump everything you know into the vault on day one. Start small, let the agents process your initial projects, and iterate over the coming weeks and months to ramp up.
  
  **A Note on AI:** Remember, this is not meant to be a perfectly deterministic system. You are operating alongside AI. What's important is that the system makes you slightly better over time, constantly enhancing your capabilities to lead your absolute best professional life.
  
  Start your journey by dropping your first raw idea or brain dump into your `inbox` zone. 
  Once saved, open it and type `/strategist` to have your new Chief Strategist convert it into a formal Project Brief.
  Next, try typing `/coach` in a new `journal` entry to get your first Socratic advisory session!

  **IMPORTANT TEMPLATE SETUP:**
  After installing this fleet and allocating the zones, you MUST use your `file_manager` tool to copy the markdown templates from `AgenticVault/fleets/business_of_you/templates/` directly into the user's mapped `templates` zone so the agents can access them.
required_zones:
  - zone_id: inbox
    vault_path: 00_Inbox
    description: "The drop zone for raw thoughts and web clippings."
  - zone_id: strategy
    vault_path: 10_Strategy
    description: "Contains formal OKRs and project briefs."
  - zone_id: execution
    vault_path: 20_Execution
    description: "Contains the tasks.jsonl queue and sprint boards."
  - zone_id: briefings
    vault_path: 30_Briefings
    description: "Contains unified Daily Notes."
  - zone_id: agendas
    vault_path: 35_Agendas
    description: "Staging ground for upcoming meeting agendas, talking points, and 1:1 structures."
  - zone_id: network
    vault_path: 40_Network
    description: "CRM tracking relationships, featuring YAML trackers for rhythms (consecutive-tactical-meetings) and relationship-tiers (manager, peer)."
  - zone_id: radar
    vault_path: 50_Radar
    description: "Watchlist for emerging trends and research."
  - zone_id: journal
    vault_path: 60_Journal
    description: "Private boardroom for raw dumps and post-mortems."
  - zone_id: rubrics
    vault_path: 80_Company_Rubrics
    description: "Reference folder containing official HR rubrics, promotion packets, and leveling docs."
  - zone_id: templates
    vault_path: 90_Templates
    description: "The repository of dynamic templates owned and iteratively updated by the personas."
  - zone_id: workspace
    vault_path: 99_Agent_Workspace
    description: "Scratchpad for Specialists and Researchers."
---
