import search from 'duckduckgo-search';
async function run() {
    try {
        const results = [];
        const generator = await search.text('obsidian app', { safeSearch: 'off' });
        for await (const result of generator) {
            results.push(result);
            if (results.length >= 5) break;
        }
        console.log(JSON.stringify(results, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
