import os

directory = "/Users/raytiong/projects/obsidian-hack/.obsidian/plugins/wizzy"

replacements = {
    "5 - Sherpa": "AgenticVault",
    "Career Sherpa": "Agentic Vault",
    "CareerSherpa": "AgenticVault",
    "career-sherpa": "agentic-vault",
    "obsidian-sample-plugin": "obsidian-agentic-vault"
}

def process_file(filepath):
    try:
        with open(filepath, 'r') as file:
            content = file.read()
        
        new_content = content
        for old, new in replacements.items():
            new_content = new_content.replace(old, new)
            
        if new_content != content:
            with open(filepath, 'w') as file:
                file.write(new_content)
            print(f"Updated {filepath}")
    except Exception as e:
        print(f"Skipping {filepath} due to {e}")

for root, dirs, files in os.walk(directory):
    if ".git" in root or "node_modules" in root:
        continue
    for file in files:
        if file.endswith(('.ts', '.json', '.md', '.js', '.mjs')):
            process_file(os.path.join(root, file))
