const fs = require('fs');
const execSync = require('child_process').execSync;

const md = fs.readFileSync('/Users/raytiong/projects/obsidian-hack/5 - Sherpa/tools/update_memory.md', 'utf8');
const match = md.match(/```javascript\n([\s\S]*?)```/);
if (match) {
    const script = match[1].replace(/'/g, "'\\''"); // escape single quotes for bash
    
    // Test 1: add_fact to global
    const payload1 = JSON.stringify({
        action: "add_fact",
        scope: "global",
        category: "Career Goals",
        fact: "I want to be a CTO in 3 years."
    });
    console.log("Test 1:");
    try {
        console.log(execSync(`node -e '${script}' '${payload1}'`, { cwd: '/Users/raytiong/projects/obsidian-hack' }).toString());
    } catch(e) { console.error(e.stdout?.toString(), e.stderr?.toString()) }

    // Test 2: add_fact to persona
    const payload2 = JSON.stringify({
        action: "add_fact",
        scope: "persona",
        category: "Preferences",
        fact: "Be brutally honest and direct.",
        persona_name: "Career Mentor"
    });
    console.log("Test 2:");
    try {
        console.log(execSync(`node -e '${script}' '${payload2}'`, { cwd: '/Users/raytiong/projects/obsidian-hack' }).toString());
    } catch(e) { console.error(e.stdout?.toString(), e.stderr?.toString()) }

    // Test 3: replace_fact
    const payload3 = JSON.stringify({
        action: "replace_fact",
        scope: "global",
        category: "Career Goals",
        old_fact: "CTO in 3 years",
        fact: "I want to be a Solo Founder in 2 years."
    });
    console.log("Test 3:");
    try {
        console.log(execSync(`node -e '${script}' '${payload3}'`, { cwd: '/Users/raytiong/projects/obsidian-hack' }).toString());
    } catch(e) { console.error(e.stdout?.toString(), e.stderr?.toString()) }

    // Test 4: remove_fact
    const payload4 = JSON.stringify({
        action: "remove_fact",
        scope: "persona",
        category: "Preferences",
        old_fact: "brutally honest",
        persona_name: "Career Mentor"
    });
    console.log("Test 4:");
    try {
        console.log(execSync(`node -e '${script}' '${payload4}'`, { cwd: '/Users/raytiong/projects/obsidian-hack' }).toString());
    } catch(e) { console.error(e.stdout?.toString(), e.stderr?.toString()) }


    console.log("\nShared Memory Contents:\n");
    console.log(fs.readFileSync('/Users/raytiong/projects/obsidian-hack/5 - Sherpa/memory/shared_memory.md', 'utf8'));

    console.log("\nPersona Memory Contents:\n");
    console.log(fs.readFileSync('/Users/raytiong/projects/obsidian-hack/5 - Sherpa/memory/personas/career_mentor_memory.md', 'utf8'));

} else {
    console.error("Could not find javascript block");
}
