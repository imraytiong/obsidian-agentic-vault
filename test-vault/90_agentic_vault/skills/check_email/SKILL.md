---
name: Check Email
description: Connects to the user's inbox to summarize new emails for the current day.
---
# Skill: Check Email

## Objective
Log into the user's email client using the Workspace MCP, fetch unread emails received today, and generate a daily summary.

## Required Tools
1. Workspace MCP (e.g., gmail_search, google_workspace)
2. file_manager

## Standard Operating Procedure
### Step 1: Fetch Today's Emails
Use your available Workspace MCP tools to search for and retrieve the contents of the latest emails received today.

### Step 2: Summarize
Analyze the retrieved emails and generate a concise summary, clearly highlighting any urgent actionable items, meetings, or requests.

### Step 3: Write Report
Use the `file_manager` tool to write or overwrite the generated summary to a file named `Daily_Email_Summary.md` in the root of the vault.
