import fs from 'fs';
import path from 'path';

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(file));
        } else {
            if (file.endsWith('.md')) {
                results.push(file);
            }
        }
    });
    return results;
}

const fleetsDir = path.join(process.cwd(), 'src/fleets');
const files = walkDir(fleetsDir);

for (const file of files) {
    if (file.includes('/personas/')) {
        let content = fs.readFileSync(file, 'utf-8');
        
        let targetTier = 'Fast';
        const lowerFile = file.toLowerCase();
        
        if (lowerFile.includes('strategist') || lowerFile.includes('coach') || lowerFile.includes('coo')) {
            targetTier = 'Reasoning';
        } else if (lowerFile.includes('pager')) {
            targetTier = 'Light';
        }
        
        if (!content.includes('model_preference:')) {
            const parts = content.split('---');
            if (parts.length >= 3) {
                // parts[0] is empty (before first ---)
                // parts[1] is frontmatter
                // parts[2] is body
                parts[1] = parts[1] + `model_preference:\n  target: ${targetTier}\n  allow_fallback: true\n`;
                content = parts.join('---');
                fs.writeFileSync(file, content);
                console.log(`Fixed ${file} with target ${targetTier}`);
            }
        }
    }
}
