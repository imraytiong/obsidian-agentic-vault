import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
    const client = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
    const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@alanxchen/google-workspace-mcp"]
    });
    console.log("Connecting...");
    try {
        await client.connect(transport);
        console.log("Connected!");
        const tools = await client.listTools();
        console.log("Tools:", tools);
    } catch (e) {
        console.error("Error:", e);
    }
}
main();
