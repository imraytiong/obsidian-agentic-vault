---
name: file_manager
description: Autonomously scaffolds new folders, generates templated notes, or writes Markdown content directly to the file system using semantic zones.
parameters:
  - name: action
    type: string
    description: "The action to perform: 'create_folder', 'write_file', or 'read_file'"
    required: true
  - name: zone_id
    type: string
    description: "The semantic zone where the action should take place."
    enum: "{{ZONES_ENUM}}"
    required: true
  - name: relative_filename
    type: string
    description: "The relative path within the zone (e.g., 'Website Redesign/Plan.md' or 'new_note.md')."
    required: true
  - name: content
    type: string
    description: "The markdown content to write (required if action is 'write_file')."
    required: false
---

```javascript
const fs = require('fs');
const path = require('path');

try {
    const argsRaw = process.argv[1];
    const args = JSON.parse(argsRaw || '{}');
    
    const action = args.action;
    const zoneId = args.zone_id;
    const relativeFilename = args.relative_filename;
    const content = args.content || '';

    if (!action || !zoneId || !relativeFilename) {
        console.log(JSON.stringify({ error: "Missing required arguments: action, zone_id, relative_filename" }));
        process.exit(1);
    }

    const zones = args.__ZONES__;
    if (!zones || !zones[zoneId]) {
        console.log(JSON.stringify({ error: `Permission Denied: Invalid zone '${zoneId}'. Zone does not exist in configuration.` }));
        process.exit(1);
    }

    const vaultRoot = args.__VAULT_ROOT__;
    const zonePath = zones[zoneId].path;
    
    // Prevent directory traversal attacks
    if (relativeFilename.includes('../')) {
         console.log(JSON.stringify({ error: "Permission Denied: Directory traversal is strictly prohibited." }));
         process.exit(1);
    }

    const fullPath = path.resolve(vaultRoot, zonePath, relativeFilename);

    if (action === 'create_folder') {
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            console.log(JSON.stringify({ status: "success", message: `Folder created in zone ${zoneId}: ${relativeFilename}`, side_effects: [{ type: 'mkdir', path: `${zonePath}/${relativeFilename}` }] }));
        } else {
            console.log(JSON.stringify({ status: "skipped", message: `Folder already exists in zone ${zoneId}: ${relativeFilename}` }));
        }
    } 
    else if (action === 'write_file') {
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(JSON.stringify({ status: "success", message: `File written to zone ${zoneId}: ${relativeFilename}`, side_effects: [{ type: 'write', path: `${zonePath}/${relativeFilename}` }] }));
    }
    else if (action === 'read_file') {
        if (fs.existsSync(fullPath)) {
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            console.log(JSON.stringify({ status: "success", content: fileContent }));
        } else {
            console.log(JSON.stringify({ error: `File not found in zone ${zoneId}: ${relativeFilename}` }));
        }
    }
    else {
        console.log(JSON.stringify({ error: `Unknown action: ${action}` }));
    }

} catch (e) {
    console.log(JSON.stringify({ error: e.message }));
    process.exit(1);
}
```
