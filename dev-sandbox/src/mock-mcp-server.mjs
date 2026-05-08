import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "mock-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "mock_network_tool",
        description: "A mock network tool to test MCP connections.",
        inputSchema: {
          type: "object",
          properties: {
            delay: {
              type: "number",
              description: "Time to delay in ms"
            },
            fail: {
              type: "boolean",
              description: "Whether to fail"
            }
          }
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = request.params.arguments || {};
  
  if (args.delay) {
    await new Promise(r => setTimeout(r, Number(args.delay)));
  }
  
  if (args.fail) {
    throw new Error("Mock network error");
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ status: "success", data: "Mock payload response" })
      }
    ]
  };
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch(console.error);
