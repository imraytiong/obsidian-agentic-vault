const targetModel = 'gemini-2.5-flash';
const apiKey = ''; // intentionally empty
const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] })
}).then(async res => {
    console.log("Status:", res.status);
    console.log("Text:", await res.text());
}).catch(e => console.error("Network Error:", e.message));
