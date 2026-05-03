---
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

```javascript
// execution
const { execSync } = require('child_process');

module.exports = async function(args) {
    const query = args.query.replace(/"/g, '\\"');
    try {
        const stdout = execSync(`node "${__dirname}/web_search.js" "${query}"`, { encoding: 'utf8' });
        return stdout;
    } catch (e) {
        return JSON.stringify({ error: "Failed to execute search: " + e.message });
    }
}
```
