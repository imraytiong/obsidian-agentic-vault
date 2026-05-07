---
name: Morning Briefing (Genesis Loop)
trigger: "cron(0 7 * * 1-5)"
agent: Chief of Staff
status: active
capabilities:
  - generate_daily_brief
---
# Context
This routine fires every weekday morning at 7:00 AM. 

# Capability Definition: `generate_daily_brief`
**Execution Steps:**
1. Call `read_calendar` to get today's meetings.
2. Call `crm_query` to extract relationship metadata for any external meeting attendees (last sync date, relationship tier).
3. Call `manage_queue` to read the top 3 high-priority tickets from `tasks.jsonl` in the `execution` zone.
4. Read `Daily_Briefing_Template.md` from the `templates` zone.
5. Synthesize all this information and save it as a unified markdown note inside the `briefings` zone named `YYYY-MM-DD_Daily_Note.md`.
