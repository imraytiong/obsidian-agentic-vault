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
        
        // Remove existing model_preference if it exists
        content = content.replace(/model_preference:[\s\S]*?(?=---)/, '');
        
        let targetTier = 'Fast';
        const lowerFile = file.toLowerCase();
        
        if (lowerFile.includes('strategist') || lowerFile.includes('coach') || lowerFile.includes('coo')) {
            targetTier = 'Reasoning';
        } else if (lowerFile.includes('pager')) {
            targetTier = 'Light';
        }
        
        // Add new model_preference
        const newFrontmatter = `model_preference:\n  target: ${targetTier}\n  allow_fallback: true\n`;
        content = content.replace(/---\n$/, `${newFrontmatter}---\n`);
        
        fs.writeFileSync(file, content);
        console.log(`Updated ${file} to ${targetTier}`);
    }
}
