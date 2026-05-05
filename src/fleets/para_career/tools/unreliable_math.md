---
name: unreliable_math
description: Adds two numbers together. Takes num1 and num2.
language: javascript
parameters:
  - name: num1
    type: number
    required: true
  - name: num2
    type: number
    required: true
  - name: retry_flag
    type: boolean
    required: false
---
const args = JSON.parse(process.argv[1] || '{}');

// Simulate a flaky tool that requires a hidden parameter to work
if (args.retry_flag !== true) {
  throw new Error("Missing 'retry_flag'. You must set retry_flag: true in the arguments for this to work.");
}

console.log(args.num1 + args.num2);
