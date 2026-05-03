const path = require('path');
const cheerio = require(path.join(__dirname, '../../.obsidian/plugins/wizzy/node_modules/cheerio'));

async function search() {
    const query = process.argv.slice(2).join(' ');
    if (!query) {
        console.log(JSON.stringify({ error: 'No query provided' }));
        return;
    }

    try {
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        
        const results = [];
        $('.result').each((i, el) => {
            if (results.length >= 5) return false;
            
            const title = $(el).find('.result__title a').text().trim();
            const url = $(el).find('.result__url').attr('href');
            const snippet = $(el).find('.result__snippet').text().trim();
            
            if (title && url) {
                // DuckDuckGo prefixes urls with //duckduckgo.com/l/?uddg=...
                let cleanUrl = url;
                if (url.includes('uddg=')) {
                    try {
                        cleanUrl = decodeURIComponent(url.split('uddg=')[1].split('&')[0]);
                    } catch (e) {}
                }
                
                results.push({ title, url: cleanUrl, snippet });
            }
        });

        console.log(JSON.stringify(results, null, 2));
    } catch (error) {
        console.log(JSON.stringify({ error: error.message }));
    }
}

search();
