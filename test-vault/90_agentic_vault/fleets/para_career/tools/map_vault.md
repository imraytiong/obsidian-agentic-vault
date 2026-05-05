---
name: map_vault
description: Recursively scans a target directory for Markdown files, extracts YAML frontmatter, tags, and semantic wiki-links to build a relationship graph.
parameters:
  - name: targetPath
    type: string
    description: "The relative path to the vault folder to scan (e.g. '4 - Archives' or '3 - Resources'). Use '.' for the vault root."
    required: true
---

```javascript
const fs = require('fs');
const path = require('path');

try {
    const argsRaw = process.argv[1];
    const args = JSON.parse(argsRaw || '{}');
    const targetPath = args.targetPath || '.';

    const fullPath = path.resolve(process.cwd(), targetPath);
    if (!fs.existsSync(fullPath)) {
        console.log(JSON.stringify({ error: `Path does not exist: ${fullPath}` }));
        process.exit(1);
    }

    const extractLinks = (content) => {
        const regex = /[[(.*?)]]/g;
        const links = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            links.push(match[1].split('|')[0].trim());
        }
        return links;
    };

    const extractTags = (content) => {
        const tags = new Set();
        
        // Extract inline tags
        const inlineRegex = /#([a-zA-Z0-9_-]+)/g;
        let match;
        while ((match = inlineRegex.exec(content)) !== null) {
            tags.add(match[1]);
        }
        
        // Extract YAML tags
        const yamlMatch = content.match(/^---
([sS]*?)
---/);
        if (yamlMatch) {
            const yamlStr = yamlMatch[1];
            const tagsMatch = yamlStr.match(/tags:s*
((?:s*-s*.*
?)*)/);
            if (tagsMatch) {
                const list = tagsMatch[1].split('
');
                for (let item of list) {
                    item = item.replace('-', '').trim();
                    if (item) tags.add(item);
                }
            }
        }
        
        return Array.from(tags);
    };

    const scanDir = (dir) => {
        let results = [];
        const files = fs.readdirSync(dir);
        for (const file of files) {
            // Ignore hidden files, standard ignore dirs, and the Sherpa system folder
            if (file.startsWith('.') || file === 'node_modules' || file === '5 - Sherpa') continue;
            
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                results = results.concat(scanDir(filePath));
            } else if (filePath.endsWith('.md')) {
                const content = fs.readFileSync(filePath, 'utf-8');
                results.push({
                    file: file,
                    path: filePath.replace(process.cwd() + '/', ''),
                    links: extractLinks(content),
                    tags: extractTags(content),
                    size: stat.size
                });
            }
        }
        return results;
    };

    const files = scanDir(fullPath);
    
    // Sort to give the LLM the most connected notes
    const sortedFiles = files.sort((a, b) => b.links.length - a.links.length);
    
    const graph = {
        scannedDirectory: targetPath,
        totalFiles: files.length,
        topNodes: sortedFiles.slice(0, 50).map(f => ({ 
            path: f.path, 
            tags: f.tags, 
            linkCount: f.links.length 
        }))
    };
    
    console.log(JSON.stringify(graph));
} catch (e) {
    console.log(JSON.stringify({ error: e.message }));
    process.exit(1);
}
```
