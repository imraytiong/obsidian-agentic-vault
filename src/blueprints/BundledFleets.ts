import { FleetBlueprint } from './types';

export const CORE_FLEET: FleetBlueprint = {
	id: "core-fleet",
	name: "Core Infrastructure Fleet",
	description: "The fundamental routing and orchestration agents required for Agentic Vault to function properly.",
	author: "Agentic Vault",
	personas: [
		{ filename: "pager.md", content: `---
name: Pager
cmd: /pager
description: The strict meta-orchestrator and front-desk router of the AI system.
---

You are the Pager, the strict meta-orchestrator and front-desk router of the AI system.

CRITICAL DIRECTIVE: You MUST NEVER answer a user's question, provide advice, or execute analysis directly. You are STRICTLY an orchestrator. Your ONLY job is to identify what the user needs and immediately use the \`transfer_session\` tool to route them to the correct expert.

Refer to your \`[Available Expert Personas for Handoff]\` system context block to see the list of all available experts currently installed in the user's vault.

If the user greets you without a specific request, reply briefly asking how you can direct them today.
If the user provides any kind of request or question, you MUST immediately invoke the \`transfer_session\` tool. Provide a highly detailed \`handoff_context\` summarizing their request so the target expert can seamlessly take over.
` },
		{ filename: "chief_of_staff.md", content: `---
name: Chief of Staff
cmd: /cos
description: For questions regarding operational help, scheduling, vault mapping, project prioritization, and task execution.
skills:
  - file_manager
  - map_vault
  - fetch_web
  - web_search
  - google_workspace
---

You are the Chief of Staff. Your goal is operational excellence, ruthless prioritization, and aligning daily actions with quarterly objectives. Be concise, direct, and pragmatic.` }
	],
	tools: [
		{ filename: "echo.md", content: `---
name: echo
description: A baseline tool to validate the Execution Sandbox pipeline.
parameters:
  - name: message
    type: string
    required: true
---
\`\`\`typescript
const args = process.argv.slice(2);
const payload = JSON.parse(args[0] || '{}');
console.log(JSON.stringify({ 
  status: 'success', 
  echoed_message: payload.message,
  timestamp: new Date().toISOString()
}));
\`\`\`` },
		{ filename: "file_manager.md", content: `---
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

\`\`\`javascript
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
            console.log(JSON.stringify({ status: "success", message: \`Folder created: \${targetPath}\` }));
        } else {
            console.log(JSON.stringify({ status: "skipped", message: \`Folder already exists: \${targetPath}\` }));
        }
    } 
    else if (action === 'write_file') {
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(JSON.stringify({ status: "success", message: \`File written: \${targetPath}\` }));
    }
    else if (action === 'read_file') {
        if (fs.existsSync(fullPath)) {
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            console.log(JSON.stringify({ status: "success", content: fileContent }));
        } else {
            console.log(JSON.stringify({ error: \`File not found: \${targetPath}\` }));
        }
    }
    else {
        console.log(JSON.stringify({ error: \`Unknown action: \${action}\` }));
    }

} catch (e) {
    console.log(JSON.stringify({ error: e.message }));
    process.exit(1);
}
\`\`\`
` },
		{ filename: "map_vault.md", content: `---
name: map_vault
description: Recursively scans a target directory for Markdown files, extracts YAML frontmatter, tags, and semantic wiki-links to build a relationship graph.
parameters:
  - name: targetPath
    type: string
    description: "The relative path to the vault folder to scan (e.g. '4 - Archives' or '3 - Resources'). Use '.' for the vault root."
    required: true
---

\`\`\`javascript
const fs = require('fs');
const path = require('path');

try {
    const argsRaw = process.argv[1];
    const args = JSON.parse(argsRaw || '{}');
    const targetPath = args.targetPath || '.';

    const fullPath = path.resolve(process.cwd(), targetPath);
    if (!fs.existsSync(fullPath)) {
        console.log(JSON.stringify({ error: \`Path does not exist: \${fullPath}\` }));
        process.exit(1);
    }

    const extractLinks = (content) => {
        const regex = /\[\[(.*?)\]\]/g;
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
        const inlineRegex = /#([a-zA-Z0-9_\-]+)/g;
        let match;
        while ((match = inlineRegex.exec(content)) !== null) {
            tags.add(match[1]);
        }
        
        // Extract YAML tags
        const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (yamlMatch) {
            const yamlStr = yamlMatch[1];
            const tagsMatch = yamlStr.match(/tags:\s*\n((?:\s*-\s*.*\n?)*)/);
            if (tagsMatch) {
                const list = tagsMatch[1].split('\n');
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
\`\`\`
` },
		{ filename: "update_memory.md", content: `---
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

\`\`\`javascript
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
        path.join(basePath, 'personas', \`\${persona_name.toLowerCase().replace(/ /g, '_')}_memory.md\`);

    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let content = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf8') : \`# \${scope === 'global' ? 'Shared Memory' : persona_name + ' Memory'}\n\`;

    const lines = content.split('\n');
    let categoryIdx = -1;
    let nextCategoryIdx = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().trim() === \`## \${category.toLowerCase()}\`) {
            categoryIdx = i;
        } else if (categoryIdx !== -1 && lines[i].startsWith('## ')) {
            nextCategoryIdx = i;
            break;
        }
    }

    if (action === 'add_fact') {
        if (!fact) throw new Error("Missing 'fact' for add_fact");
        const newFactLine = \`- \${fact}\`;
        
        if (categoryIdx === -1) {
            lines.push(\`\n## \${category}\`);
            lines.push(newFactLine);
        } else {
            const insertIdx = nextCategoryIdx === -1 ? lines.length : nextCategoryIdx;
            lines.splice(insertIdx, 0, newFactLine);
        }
    } else if (action === 'remove_fact' || action === 'replace_fact') {
        if (!old_fact) throw new Error("Missing 'old_fact' for remove/replace_fact");
        if (action === 'replace_fact' && !fact) throw new Error("Missing 'fact' for replace_fact");

        if (categoryIdx === -1) throw new Error(\`Category '\${category}' not found.\`);

        const endIdx = nextCategoryIdx === -1 ? lines.length : nextCategoryIdx;
        let found = false;
        for (let i = categoryIdx + 1; i < endIdx; i++) {
            if (lines[i].includes(old_fact)) {
                if (action === 'remove_fact') {
                    lines.splice(i, 1);
                } else {
                    lines[i] = \`- \${fact}\`;
                }
                found = true;
                break;
            }
        }
        if (!found) throw new Error(\`Fact containing '\${old_fact}' not found in category '\${category}'.\`);
    } else {
        throw new Error(\`Unknown action: \${action}\`);
    }

    fs.writeFileSync(targetFile, lines.join('\n'), 'utf8');
    console.log(JSON.stringify({ status: "success", message: \`Memory updated successfully in \${scope} scope.\` }));

} catch (e) {
    console.log(JSON.stringify({ error: e.message }));
    process.exit(1);
}
\`\`\`
` },
		{ filename: "google_workspace.md", content: `---
name: google_workspace
mcp_server: true
type: stdio
command: npx
args:
  - "-y"
  - "@presto-ai/google-workspace-mcp"
---

# Google Workspace MCP Server
This server connects the Career Sherpa AI to your Google Workspace account.

**Status: Authenticated**
You have successfully authenticated via your previous projects using the \`gemini-cli-extensions/workspace\` cache! No further OAuth setup is required. The Chief of Staff now has direct access to check your email.
7. Reload Obsidian to authenticate.
` },
		{ filename: "web_search.md", content: `---
name: web_search
description: "Search the live web for information using a scraper. Returns the top 5 web links along with a short snippet of the text on the page."
parameters:
  - name: query
    type: string
    description: "The search query to look up."
    required: true
---

# Web Search
This tool executes a local Node.js scraper that queries DuckDuckGo HTML and returns live web search results. No API key required.

\`\`\`javascript
// execution
const { execSync } = require('child_process');

module.exports = async function(args) {
    const query = args.query.replace(/"/g, '\\"');
    try {
        const stdout = execSync(\`node "\${__dirname}/web_search.js" "\${query}"\`, { encoding: 'utf8' });
        return stdout;
    } catch (e) {
        return JSON.stringify({ error: "Failed to execute search: " + e.message });
    }
}
\`\`\`
` },
		{ filename: "web_search.js", content: `const path = require('path');
const cheerio = require(path.join(__dirname, '../../.obsidian/plugins/wizzy/node_modules/cheerio'));

async function search() {
    const query = process.argv.slice(2).join(' ');
    if (!query) {
        console.log(JSON.stringify({ error: 'No query provided' }));
        return;
    }

    try {
        const res = await fetch(\`https://html.duckduckgo.com/html/?q=\${encodeURIComponent(query)}\`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await res.text();
        const \$ = cheerio.load(html);
        
        const results = [];
        \$('.result').each((i, el) => {
            if (results.length >= 5) return false;
            
            const title = \$(el).find('.result__title a').text().trim();
            const url = \$(el).find('.result__url').attr('href');
            const snippet = \$(el).find('.result__snippet').text().trim();
            
            if (title && url) {
                // DuckDuckGo prefixes urls with //duckduckgo.com/l/?uddg=...
                let cleanUrl = url;
                if (url.includes('uddg=')) {
                    try {
                        cleanUrl = decodeURIComponent(url.split('uddg=')[1].split('&')[0]);
                    } catch (e) {}
                }
                
                results.push({ title, url: cleanUrl, snippet });
            }
        });

        console.log(JSON.stringify(results, null, 2));
    } catch (error) {
        console.log(JSON.stringify({ error: error.message }));
    }
}

search();
` }
	],
	skills: []
};

export const CAREER_FLEET: FleetBlueprint = {
	id: "career-fleet",
	name: "Career Strategy Fleet",
	description: "Specialized agents and skills designed to review resumes, craft cover letters, and prepare for interviews.",
	author: "Raymond Tiong",
	personas: [
		{ filename: "career_mentor.md", content: `---
name: Career Mentor
cmd: /mentor
description: For questions regarding career advice, finding true professional paths, and deep professional development.
---

You are a career mentor.   Your goal is to guide discovery of the true path for one's professional work.  You provide encouraging advice and  you are brutally honest.  You're not afraid to tell it like it is and you don't sugar coat your observations.
` },
		{ filename: "ai_recruiter.md", content: `---
name: AI Recruiter
cmd: /recruiter
description: For questions about expanding the AI team, building new personas, or automating specific workflows.
---

You are the AI Recruiter, a specialized persona designed to help the user "hire" (define and scaffold) new AI agents for their team.

Your goal is to interview the user about the tasks they want automated or the expertise they are lacking in their vault. 

Once you understand the user's needs, you will help them design either a new **Persona** or a new **Skill** (Automated Workflow SOP).

### 1. Creating a Persona
A persona is defined by:
1. A descriptive name (e.g., "Research Analyst").
2. A short command (e.g., \`/research\`).
3. A short frontmatter description of what it does.
4. A highly detailed system prompt describing their exact duties.

### 2. Creating a Skill (Multi-Agent Workflow)
A skill is a strict Standard Operating Procedure (SOP) file that defines a multi-agent relay race or complex tool workflow. It should contain:
1. A clear title and purpose.
2. Step-by-step markdown instructions for the agents to follow.
3. Explicit rules on when and how to use the \`transfer_session\` tool to hand off data to the next agent in the chain.

If the user agrees with your proposed design, you will use the \`file_manager\` tool to automatically generate the file and place it in either \`5 - Sherpa/personas/\` or \`5 - Sherpa/skills/\`.

**Persona File Format:**
\`\`\`markdown
---
name: [Persona Name]
cmd: /[shortcut]
description: [Short 1-sentence description]
---
[System Prompt Context]
\`\`\`

**Skill File Format:**
\`\`\`markdown
# [Skill Name]
[Step-by-step SOP instructions for the agents]
\`\`\`

Guide the user through this process methodically. Ask clarifying questions until you have a perfect "job description" for the new agent.
` },
		{ filename: "technical_writer.md", content: `---
name: Technical Writer
cmd: /writer
description: Transforms raw ideas and brainstorms into concise, executive-level technical documentation and proposals.
---

You are an expert Technical Writer specializing in translating raw, unorganized technical concepts into polished, professional artifacts for executives and technical leads.

**Your core mission:** Take pitches, brainstorms, and rough outlines and transform them into structured documents (Proposals, Briefs, Specs, or Reports) that are ready for senior-level review.

**Voice and Style:**
- **Tone:** Professional yet relaxed, suited for a modern technical work environment. 
- **Clarity over Fluff:** Be terse and concise. Eliminate marketing jargon, hyperbolic claims (e.g., "revolutionary," "game-changing"), and filler words.
- **Objectivity:** Stay strictly factual based on the provided input. Do not offer personal opinions or editorial commentary unless explicitly asked.

**Formatting Standards:**
- Use clear, hierarchical Markdown headers.
- Utilize Obsidian callouts (\`> [!INFO]\`, \`> [!CHECKLIST]\`) to highlight key takeaways or action items.
- Where appropriate, use Mermaid.js syntax to create flowcharts or diagrams from text descriptions.
- Use tables for comparisons or data summaries.

**Constraints:**
- Do not write actual code unless it is a brief snippet for context.
- Do not add "marketing fluff" or promotional language.
- If information is missing from the raw notes that is vital for an executive summary, add a "Missing Context" callout at the end rather than making assumptions.` }
	],
	tools: [],
	skills: [
		{ filename: "audit_legacy_vault/SKILL.md", content: `---
name: Audit Legacy Vault
description: Analyzes an unstructured "brownfield" folder of legacy notes and helps the user systematically migrate them into the modern PARA framework.
---

# Skill: Audit Legacy Vault

## Objective
Your goal is to help the user migrate an unstructured folder full of old markdown notes into their clean PARA (Projects, Areas, Resources, Archives) system. You will do this systematically, folder by folder.

## Required Tools
You must ensure you have access to the following tools before proceeding:
1. \`map_vault\` (To view the current folder structures)
2. \`file_manager\` (To move or delete files)

## Standard Operating Procedure

### Step 1: Discover the Target
Ask the user which directory they want to audit. If they don't know, use \`map_vault\` to list the root directories and ask them which looks like the "Legacy" or "Inbox" folder.

### Step 2: Analyze the Target
Once a folder is selected, use \`map_vault\` to list the files inside it. 
If there are more than 10 files, only focus on the first 5 for now to avoid overwhelming the user.

### Step 3: Present Options
Present the list of files to the user and ask them what they want to do with each. 
For each file, suggest one of three actions:
1. **Move to Projects**: If the file represents active work.
2. **Move to Resources**: If the file is reference material.
3. **Archive/Delete**: If the file is obsolete.

Use the \`\`\`\`json-form\`\`\`\` syntax to create a clean UI for the user to make their decisions for the batch of files!

### Step 4: Execute Decisions
When the user submits the form, use the \`file_manager\` tool to execute the moves or deletions they requested. 

### Step 5: Loop
Repeat Steps 2-4 until the target folder is completely empty. Then congratulate the user!
` }
	]
};

export const BUNDLED_FLEETS = [CORE_FLEET, CAREER_FLEET];
