---
name: Cron File Writer
description: Writes a timestamp to scheduled_test.md
---
# Skill: Cron File Writer

## Objective
Write "chron ran <date>" to `scheduled_test.md` in the root of the vault. Create the file if it does not exist.

## Required Tools
1. file_manager

## Standard Operating Procedure
### Step 1: Write to the file
Use your `file_manager` tool to write or append "chron ran <current date>" to the file `scheduled_test.md` at the root of the vault.
