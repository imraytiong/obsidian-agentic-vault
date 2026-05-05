---
name: echo
description: A baseline tool to validate the Execution Sandbox pipeline.
parameters:
  - name: message
    type: string
    required: true
---
```typescript
const args = process.argv.slice(2);
const payload = JSON.parse(args[0] || '{}');
console.log(JSON.stringify({ 
  status: 'success', 
  echoed_message: payload.message,
  timestamp: new Date().toISOString()
}));
```