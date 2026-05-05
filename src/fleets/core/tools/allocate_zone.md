---
name: allocate_zone
description: Allocates a new semantic zone in the vault registry and maps it to a physical path. Restricted to high-level system agents.
parameters:
  - name: zone_id
    type: string
    description: "The unique ID for the new zone in snake_case (e.g., 'daily_journal')."
    required: true
  - name: vault_path
    type: string
    description: "The relative physical folder path to map this zone to (e.g., '01 - Journal')."
    required: true
  - name: description
    type: string
    description: "A semantic description instructing future agents on what this zone is meant to store."
    required: true
---

```javascript
const fs = require('fs');
const path = require('path');

try {
    const argsRaw = process.argv[1];
    const args = JSON.parse(argsRaw || '{}');
    
    const zoneId = args.zone_id;
    const vaultPathStr = args.vault_path;
    const description = args.description;

    if (!zoneId || !vaultPathStr || !description) {
        console.log(JSON.stringify({ error: "Missing required arguments: zone_id, vault_path, description" }));
        process.exit(1);
    }

    const vaultRoot = args.__VAULT_ROOT__;
    
    // Prevent directory traversal attacks
    if (vaultPathStr.includes('../')) {
         console.log(JSON.stringify({ error: "Permission Denied: Directory traversal is strictly prohibited." }));
         process.exit(1);
    }

    const fullPath = path.resolve(vaultRoot, vaultPathStr);

    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }

    console.log(JSON.stringify({ 
        status: "success", 
        message: `Zone '${zoneId}' allocated to path '${vaultPathStr}'.`,
        _INTERNAL_ALLOCATE_ZONE_TRIGGER: { 
            zone_id: zoneId, 
            path: vaultPathStr, 
            description: description 
        }
    }));

} catch (e) {
    console.log(JSON.stringify({ error: e.message }));
    process.exit(1);
}
```
