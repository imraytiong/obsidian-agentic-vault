---
name: install_fleet
description: "Installs a bundled fleet by name (e.g., 'para_career') into the active vault."
parameters:
  - name: fleet_name
    type: string
    description: "The name of the fleet to install. Allowed values are 'para_career' or 'business_of_you'."
    required: true
---

```javascript
try {
    const args = JSON.parse(process.argv[1] || '{}');
    if (!args.fleet_name) throw new Error("Missing fleet_name");
    
    console.log(JSON.stringify({ 
        status: "success", 
        message: `Triggering installation for fleet '${args.fleet_name}'...`,
        _INTERNAL_INSTALL_FLEET_TRIGGER: { 
            fleet_name: args.fleet_name
        }
    }));
} catch (e) {
    console.log(JSON.stringify({ error: e.message }));
}
```
