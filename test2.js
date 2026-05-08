const targetModel = 'gemini-2.5-flash';
const apiKey = process.env.GEMINI_API_KEY || 'fake_key'; // use a real key if you have one, or expect 400
const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [] })
}).then(async res => {
    console.log("Status:", res.status);
    console.log("Text:", await res.text());
}).catch(e => console.error("Network Error:", e.message));
