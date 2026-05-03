async function search(query) {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    const html = await res.text();
    // Use regex to extract titles and URLs
    const results = [];
    const regex = /<a class="result__url" href="([^"]+)">([^<]+)<\/a>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
        results.push({ url: match[1], snippet: match[2].trim() });
    }
    console.log(results.slice(0, 5));
}
search('obsidian app');
