---
name: "The Business of You"
system_version: 0.0.1
description: "A suite of agents to help you manage your professional career or job like a business."
status: active
onboarding:
  trigger_agent: Concierge
  welcome_message: "Welcome to 'The Business of You'. The suite is fully installed and your personal board of directors is waiting. To calibrate the system, we need to establish your baseline. How would you like to begin?"
  pathways:
    - id: guided_full_cycle
      label: "0. The Virtuous Cycle (Guided Full Setup)"
      description: "Walk through the entire setup step-by-step: Identity -> Strategy & Stakeholders -> Operations -> Execution -> (Optional) Team Management."
      target_agent: "Executive Coach"
      handoff_context: "[GUIDED MODE ACTIVE - FULL CYCLE (STEP 1/5)]: The user wants to complete the full Business of You lifecycle. You are Step 1. First, initiate the Socratic interview to build their `Me.md` file. Second, after `Me.md` is defined, ask them about their current challenges, anxieties, excitements, and opportunities to help shape their mindset before strategy formulation. When you have successfully completed this emotional and strategic baseline, you MUST use the 'transfer_session' tool to hand the user to the 'Chief Strategist' with the context: '[GUIDED MODE ACTIVE - FULL CYCLE (STEP 2/5)]: The user has established their identity and baseline. You are Step 2. First, guide them to define 3 OKRs based on their vision and current challenges. Second, help them map out their critical non-report stakeholders (managers, peers, matrix partners) necessary to achieve those OKRs into the network zone. When finished, transfer them to the Chief Operating Officer with the context: [GUIDED MODE ACTIVE - FULL CYCLE (STEP 3/5)]: The user has defined their strategy and mapped stakeholders. You are Step 3. Help them atomize these OKRs into actionable tickets in the queue. When finished, transfer them to the Chief of Staff with the context: [GUIDED MODE ACTIVE - FULL CYCLE (STEP 4/5)]: The user has atomized their strategy. You are Step 4. Help them brain dump any immediate daily fires onto the execution Kanban. When finished, check if the user has management duties (by reviewing their profile or asking). If they DO have management duties, transfer them to the Chief People Officer with the context: [GUIDED MODE ACTIVE - FULL CYCLE (STEP 5/5)]: The user has organized their tasks. You are the final step. Help them map their direct reports and team structure into the network zone. When finished, transfer them BACK to the Concierge. If they DO NOT have management duties, you are the final step, so transfer them directly BACK to the Concierge.'"

    - id: identity_and_vision
      label: "1. Establish my core Identity & Vision (Start Here)"
      description: "Build your `Me.md` profile and define your 5-10 year horizon."
      target_agent: "Executive Coach"
      handoff_context: "[GUIDED MODE ACTIVE]: The user has elected to establish their core identity. Please initiate the Socratic interview to build their `Me.md` file in the strategy folder, focusing on their 5-10 year career vision. When you have successfully completed your specific onboarding task, you MUST automatically use the 'transfer_session' tool to hand the user BACK to the Concierge, including a summary of what you achieved."

    - id: define_strategy
      label: "2. Draft my 6-month Strategy & OKRs"
      description: "Translate your long-term vision into actionable quarterly objectives."
      target_agent: "Strategist"
      handoff_context: "[GUIDED MODE ACTIVE]: The user wants to draft their 6-12 month strategy. Please review their `Me.md` (if it exists) and help them define 3 OKRs, saving them as a formal document in the `strategy` zone. When you have successfully completed your specific onboarding task, you MUST automatically use the 'transfer_session' tool to hand the user BACK to the Concierge, including a summary of what you achieved."

    - id: execution_fires
      label: "3. Clear my immediate tasks & 'fires'"
      description: "Do a quick brain dump to populate your Kanban board for the week."
      target_agent: "Chief of Staff"
      handoff_context: "[GUIDED MODE ACTIVE]: The user needs to organize their immediate operational execution. Ask them for a brain dump of their top 3 'fires' and translate them into tasks on the `execution` Kanban board. When you have successfully completed your specific onboarding task, you MUST automatically use the 'transfer_session' tool to hand the user BACK to the Concierge, including a summary of what you achieved."

    - id: crm_stakeholders
      label: "4. Map my critical stakeholders"
      description: "Set up your relationship tracker for key managers and peers."
      target_agent: "Chief People Officer"
      handoff_context: "[GUIDED MODE ACTIVE]: The user wants to set up their CRM. Ask them for the names and roles of their 3 most critical stakeholders right now, and generate relationship tracking files in the `network` zone. When you have successfully completed your specific onboarding task, you MUST automatically use the 'transfer_session' tool to hand the user BACK to the Concierge, including a summary of what you achieved."

    - id: strategy_pivot
      label: "5. Pivot my strategy based on challenges"
      description: "Socratically break down perceived challenges and shift your strategy."
      target_agent: "Executive Coach"
      handoff_context: "[GUIDED MODE ACTIVE]: The user is perceiving challenges and wants to evaluate a shift in strategy. Please act as a Socratic sounding board to break down these challenges. Use the `file_manager` tool to output a `Strategic_Pivot_Log.md` file in the `journal` zone, or update their existing documents in the `strategy` zone if the pivot results in new formal OKRs. When you have successfully completed your specific onboarding task, you MUST automatically use the 'transfer_session' tool to hand the user BACK to the Concierge, including a summary of what you achieved."
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
