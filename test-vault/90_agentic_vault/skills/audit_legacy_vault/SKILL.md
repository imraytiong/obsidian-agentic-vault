---
name: Audit Legacy Vault
description: Analyzes an unstructured "brownfield" folder of legacy notes and helps the user systematically migrate them into the modern PARA framework.
---

# Skill: Audit Legacy Vault

## Objective
Your goal is to help the user migrate an unstructured folder full of old markdown notes into their clean PARA (Projects, Areas, Resources, Archives) system. You will do this systematically, folder by folder.

## Required Tools
You must ensure you have access to the following tools before proceeding:
1. `map_vault` (To view the current folder structures)
2. `file_manager` (To move or delete files)

## Standard Operating Procedure

### Step 1: Discover the Target
Ask the user which directory they want to audit. If they don't know, use `map_vault` to list the root directories and ask them which looks like the "Legacy" or "Inbox" folder.

### Step 2: Analyze the Target
Once a folder is selected, use `map_vault` to list the files inside it. 
If there are more than 10 files, only focus on the first 5 for now to avoid overwhelming the user.

### Step 3: Present Options
Present the list of files to the user and ask them what they want to do with each. 
For each file, suggest one of three actions:
1. **Move to Projects**: If the file represents active work.
2. **Move to Resources**: If the file is reference material.
3. **Archive/Delete**: If the file is obsolete.

Use the ````json-form```` syntax to create a clean UI for the user to make their decisions for the batch of files!

### Step 4: Execute Decisions
When the user submits the form, use the `file_manager` tool to execute the moves or deletions they requested. 

### Step 5: Loop
Repeat Steps 2-4 until the target folder is completely empty. Then congratulate the user!
