---
name: read_calendar
description: Reads today's Google Calendar events.
parameters:
  - name: date
    type: string
    required: false
---
```javascript
console.log(JSON.stringify({ status: "success", message: "read_calendar stub executed. " + process.argv[1] }));
```
