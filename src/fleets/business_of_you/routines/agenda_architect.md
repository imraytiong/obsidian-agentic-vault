---
name: The 1:1 Architect Loop
trigger: "cron(0 8 * * *)"
agent: Chief of Staff
status: active
capabilities:
  - construct_dynamic_agendas
---
# Context
Scans the calendar for upcoming 1:1s (24h out). Pulls CRM metadata, relationship tiers, and rhythm trackers. Triggers a Specialist (Communicator) to draft an archetype-specific agenda in the `agendas` zone.

# Capability Definition: `construct_dynamic_agendas`
**Execution Steps:**
1. The CoS detects a meeting 24h away.
2. The CoS queries the `network` zone for the counterparty's profile and rhythm tracker (`consecutive-tactical-meetings`).
3. The CoS constructs a payload outlining active blockers from the `strategy` zone and the historical metadata, then invokes the `/comms` agent.
4. The `/comms` agent runs the Rotation Engine logic: if the tracker exceeds 3 consecutive tactical meetings, override to Format C (Disruption) or Format B (Zoom-Out). Otherwise, draft Format A (Tactical Sync).
5. The `/comms` agent reads `1_on_1_Agenda_Template.md` from the `templates` zone, fills it out based on the chosen archetype, and saves the output to the `agendas` zone.
6. The `/comms` agent increments the `consecutive-tactical-meetings` counter in the CRM file.
