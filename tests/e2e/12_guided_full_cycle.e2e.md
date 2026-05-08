# Scenario: Virtuous Cycle Guided Tour Handoff Sequence
**Description:** Verifies that the Concierge successfully hands the user off to the Executive Coach via the `guided_full_cycle` pathway, and passes the required daisy-chained payload.

### Step 1: Initialize Concierge Onboarding
**User:** (Initiating vault setup)
```json
{
  "activePersona": "Concierge",
  "mockAppConfig": { "isFirstBoot": true }
}
```
**Expected Tool Call:** `present_options`
**Expected Argument:** `options[?id == 'business_of_you']`
**Mock User Response:** I select the option with id `business_of_you`

### Step 2: Agentic Vault Installation & Fleet Menu
**Expected Tool Call:** `install_fleet`
**Expected Argument:** `fleet_name: "business_of_you"`
**System Inject:** (Tool returns zone requirements and onboarding payload)
**Expected Tool Call:** `allocate_zone`
**Expected Argument:** `zone_id: "strategy"`
**Expected Tool Call:** `present_options`
**Expected Argument:** `options[?id == 'guided_full_cycle']`
**Mock User Response:** I select the option with id `guided_full_cycle`

### Step 3: Handoff to Executive Coach
**Expected Tool Call:** `transfer_session`
**Expected Argument:** `target_agent: "Executive Coach"`
**Expected Argument:** `handoff_context: "[GUIDED MODE ACTIVE - FULL CYCLE (STEP 1/5)]"`
