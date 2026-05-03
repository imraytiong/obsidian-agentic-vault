---
name: file_manager
description: Autonomously scaffolds new folders, generates templated notes, or writes Markdown content directly to the file system.
parameters:
  - name: action
    type: string
    description: "The action to perform: 'create_folder', 'write_file', or 'read_file'"
    required: true
  - name: targetPath
    type: string
    description: "The relative path in the vault (e.g. '1 - Projects/New Project' or '5 - Sherpa/new_note.md')"
    required: true
  - name: content
    type: string
    description: "The markdown content to write (required if action is 'write_file')"
    required: false
---

```javascript
const fs = require('fs');
const path = require('path');

try {
    const argsRaw = process.argv[1];
    const args = JSON.parse(argsRaw || '{}');
    
    const action = args.action;
    const targetPath = args.targetPath;
    const content = args.content || '';

    if (!action || !targetPath) {
        console.log(JSON.stringify({ error: "Missing required arguments: action, targetPath" }));
        process.exit(1);
    }

    const fullPath = path.resolve(process.cwd(), targetPath);

    if (action === 'create_folder') {
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            console.log(JSON.stringify({ status: "success", message: `Folder created: ${targetPath}` }));
        } else {
            console.log(JSON.stringify({ status: "skipped", message: `Folder already exists: ${targetPath}` }));
        }
    } 
    else if (action === 'write_file') {
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(JSON.stringify({ status: "success", message: `File written: ${targetPath}` }));
    }
    else if (action === 'read_file') {
        if (fs.existsSync(fullPath)) {
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            console.log(JSON.stringify({ status: "success", content: fileContent }));
        } else {
            console.log(JSON.stringify({ error: `File not found: ${targetPath}` }));
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
