---
name: The Strategic Realignment Loop (Sprint Review)
trigger: "cron(0 16 * * 5)"
agent: Chief Quality Officer
status: active
capabilities:
  - generate_deviation_report
---
# Context
Fires at 4:00 PM on Friday to catch tactical drift. Generates a Deviation Report for the CEO to review on Monday morning.

# Capability Definition: `generate_deviation_report`
**Execution Steps:**
1. CQO reads the `tasks.jsonl` in the `execution` zone to tally what was actually completed this week.
2. CQO reads the current OKRs in the `strategy` zone to determine what was planned.
3. CQO calculates the "Delta" (Tactical Drift).
4. CQO reads `Deviation_Report_Template.md` from the `templates` zone and fills it out.
5. CQO writes the finalized `YYYY-MM-DD_Deviation_Report.md` into the `briefings` zone.
6. The CEO reviews the report and tags it with either `agent-action: purge-drift` or `agent-action: strategic-pivot`.
