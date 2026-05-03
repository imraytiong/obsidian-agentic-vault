---
name: update_memory
description: Autonomously manage long-term user memory files. Use this to permanently record, remove, or update facts about the user's core identity, preferences, or goals.
parameters:
  - name: action
    type: string
    description: "The action to perform: 'add_fact', 'remove_fact', or 'replace_fact'"
    required: true
  - name: scope
    type: string
    description: "The memory scope: 'global' (for shared memory) or 'persona' (for specific agent memory)"
    required: true
  - name: category
    type: string
    description: "The heading category under which this fact belongs (e.g. 'Core Values', 'Preferences', 'Active Goals')"
    required: true
  - name: persona_name
    type: string
    description: "Your persona name. Required if scope is 'persona'."
    required: false
  - name: fact
    type: string
    description: "The new fact to add or the replacement text (required for add_fact and replace_fact)"
    required: false
  - name: old_fact
    type: string
    description: "The exact fact to remove or replace (required for remove_fact and replace_fact)"
    required: false
---

```javascript
const fs = require('fs');
const path = require('path');

try {
    const argsRaw = process.argv[1];
    const args = JSON.parse(argsRaw || '{}');
    
    const action = args.action;
    const scope = args.scope;
    const category = args.category;
    const fact = args.fact;
    const old_fact = args.old_fact;
    const persona_name = args.persona_name;

    if (!action || !scope || !category) {
        console.log(JSON.stringify({ error: "Missing required arguments: action, scope, category" }));
        process.exit(1);
    }

    if (scope === 'persona' && !persona_name) {
        console.log(JSON.stringify({ error: "Missing required argument: persona_name when scope is 'persona'" }));
        process.exit(1);
    }

    const basePath = path.resolve(process.cwd(), '5 - Sherpa/memory');
    const targetFile = scope === 'global' ? 
        path.join(basePath, 'shared_memory.md') : 
        path.join(basePath, 'personas', `${persona_name.toLowerCase().replace(/ /g, '_')}_memory.md`);

    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let content = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf8') : `# ${scope === 'global' ? 'Shared Memory' : persona_name + ' Memory'}\n`;

    const lines = content.split('\n');
    let categoryIdx = -1;
    let nextCategoryIdx = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().trim() === `## ${category.toLowerCase()}`) {
            categoryIdx = i;
        } else if (categoryIdx !== -1 && lines[i].startsWith('## ')) {
            nextCategoryIdx = i;
            break;
        }
    }

    if (action === 'add_fact') {
        if (!fact) throw new Error("Missing 'fact' for add_fact");
        const newFactLine = `- ${fact}`;
        
        if (categoryIdx === -1) {
            lines.push(`\n## ${category}`);
            lines.push(newFactLine);
        } else {
            const insertIdx = nextCategoryIdx === -1 ? lines.length : nextCategoryIdx;
            lines.splice(insertIdx, 0, newFactLine);
        }
    } else if (action === 'remove_fact' || action === 'replace_fact') {
        if (!old_fact) throw new Error("Missing 'old_fact' for remove/replace_fact");
        if (action === 'replace_fact' && !fact) throw new Error("Missing 'fact' for replace_fact");

        if (categoryIdx === -1) throw new Error(`Category '${category}' not found.`);

        const endIdx = nextCategoryIdx === -1 ? lines.length : nextCategoryIdx;
        let found = false;
        for (let i = categoryIdx + 1; i < endIdx; i++) {
            if (lines[i].includes(old_fact)) {
                if (action === 'remove_fact') {
                    lines.splice(i, 1);
                } else {
                    lines[i] = `- ${fact}`;
                }
                found = true;
                break;
            }
        }
        if (!found) throw new Error(`Fact containing '${old_fact}' not found in category '${category}'.`);
    } else {
        throw new Error(`Unknown action: ${action}`);
    }

    fs.writeFileSync(targetFile, lines.join('\n'), 'utf8');
    console.log(JSON.stringify({ status: "success", message: `Memory updated successfully in ${scope} scope.` }));

} catch (e) {
    console.log(JSON.stringify({ error: e.message }));
    process.exit(1);
}
```
