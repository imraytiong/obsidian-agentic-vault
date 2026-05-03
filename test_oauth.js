import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
    const env = {
        ...process.env,
        GOOGLE_CLIENT_ID: "dummy",
        GOOGLE_CLIENT_SECRET: "dummy",
        GOOGLE_REDIRECT_URI: "http://localhost:3000/oauth2callback"
    };

    const client = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
    const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@alanxchen/google-workspace-mcp"],
        env
    });

    console.log("Connecting...");
    try {
        await client.connect(transport);
        console.log("Connected! Calling tool...");
        const result = await client.callTool({
            name: "search_emails",
            arguments: { query: "in:inbox" }
        });
        console.log("Tool result:", result);
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}
main();
