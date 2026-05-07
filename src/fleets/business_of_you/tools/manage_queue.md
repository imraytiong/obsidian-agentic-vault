---
name: manage_queue
description: A tool for reading and appending to the tasks.jsonl queue.
parameters:
  - name: action
    type: string
    description: "'read' to get top tasks, 'append' to add a task"
    required: true
  - name: payload
    type: string
    description: "The task data to append (if action is append)"
    required: false
---
```javascript
console.log(JSON.stringify({ status: "success", message: "manage_queue stub executed. " + process.argv[1] }));
```
