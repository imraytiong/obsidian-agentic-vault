---
name: system_diagnostic
description: A multi-purpose testing tool for validating agentic behavior, execution sandboxing, and background concurrency.
parameters:
  - name: action
    type: string
    description: "The diagnostic action to perform: 'delay', 'echo', or 'throw_error'"
    required: true
  - name: payload
    type: string
    description: "For 'delay': number of milliseconds (e.g. '10000'). For 'echo': text to repeat. For 'throw_error': the error message to simulate."
    required: true
---

```javascript
const argsRaw = process.argv[1];
const args = JSON.parse(argsRaw || '{}');

const action = args.action;
const payload = args.payload;

if (action === 'delay') {
    const ms = parseInt(payload, 10) || 1000;
    setTimeout(() => {
        console.log(JSON.stringify({ status: 'success', message: `Deliberate diagnostic delay of ${ms}ms completed.` }));
    }, ms);
} else if (action === 'echo') {
    console.log(JSON.stringify({ status: 'success', echoed: payload }));
} else if (action === 'throw_error') {
    console.error(payload || "Simulated diagnostic error.");
    process.exit(1);
} else {
    console.log(JSON.stringify({ error: `Unknown diagnostic action: ${action}` }));
    process.exit(1);
}
```