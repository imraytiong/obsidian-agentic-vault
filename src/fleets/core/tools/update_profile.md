---
name: update_profile
description: Manage the user's Me.md profile document in the strategy zone. Use this to permanently record core identity facts, career vision, and values. Upon successful creation or modification, you MUST explicitly tell the user the exact location and output an Obsidian wiki-link (e.g. [[Me]]) in your response.
parameters:
  - name: action
    type: string
    description: "The action to perform: 'overwrite' (replaces the entire file) or 'append_to_section' (adds text under a specific heading)."
    required: true
  - name: content
    type: string
    description: "The complete markdown content (for 'overwrite') or the bullet points to add (for 'append_to_section')."
    required: true
  - name: section_heading
    type: string
    description: "The exact heading name without the '#' (e.g. '5-10 Year Vision'). Required only for 'append_to_section'."
    required: false
---

```javascript
const fs = require('fs');
const path = require('path');

try {
    const argsRaw = process.argv[1];
    const args = JSON.parse(argsRaw || '{}');
    
    const action = args.action;
    const content = args.content;
    const section_heading = args.section_heading;

    if (!action || !content) {
        console.log(JSON.stringify({ error: "Missing required arguments: action, content" }));
        process.exit(1);
    }

    const strategyZone = (args.__ZONES__ && args.__ZONES__['strategy']) ? args.__ZONES__['strategy'] : '10_Strategy';
    const targetFile = path.resolve(process.cwd(), strategyZone, 'Me.md');

    if (action === 'overwrite') {
        fs.writeFileSync(targetFile, content, 'utf8');
        console.log(JSON.stringify({ status: "success", message: `Successfully overwrote Me.md in strategy zone.`, side_effects: [{ type: 'write', path: `${strategyZone}/Me.md` }] }));
    } else if (action === 'append_to_section') {
        if (!section_heading) {
            console.log(JSON.stringify({ error: "Missing required argument: section_heading when action is 'append_to_section'" }));
            process.exit(1);
        }

        if (!fs.existsSync(targetFile)) {
            console.log(JSON.stringify({ error: "Me.md does not exist yet. Please use action 'overwrite' to create the initial profile." }));
            process.exit(1);
        }

        const fileContent = fs.readFileSync(targetFile, 'utf8');
        const lines = fileContent.split('\n');
        
        let categoryIdx = -1;
        let nextCategoryIdx = -1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().trim() === `## ${section_heading.toLowerCase()}`) {
                categoryIdx = i;
            } else if (categoryIdx !== -1 && lines[i].startsWith('## ')) {
                nextCategoryIdx = i;
                break;
            }
        }

        if (categoryIdx === -1) {
             // If section not found, append it to the end of the file
             lines.push(`\n## ${section_heading}`);
             lines.push(content);
        } else {
             const insertIdx = nextCategoryIdx === -1 ? lines.length : nextCategoryIdx;
             lines.splice(insertIdx, 0, content);
        }

        fs.writeFileSync(targetFile, lines.join('\n'), 'utf8');
        console.log(JSON.stringify({ status: "success", message: `Successfully appended to section '${section_heading}' in Me.md.`, side_effects: [{ type: 'write', path: `${strategyZone}/Me.md` }] }));
    } else {
        throw new Error(`Unknown action: ${action}`);
    }

} catch (e) {
    console.log(JSON.stringify({ error: e.message }));
    process.exit(1);
}
```
