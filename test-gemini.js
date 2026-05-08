const apiKey = "AIzaSyA25LglHa1-zYILxaW3HVpYHifTBmn9Xls";
const model = "gemini-3.1-pro-preview";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

const body = {
  contents: [
    {
      role: "user",
      parts: [{ text: "Hello" }]
    }
  ]
};

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
}).then(res => res.text().then(text => console.log(res.status, text))).catch(console.error);
