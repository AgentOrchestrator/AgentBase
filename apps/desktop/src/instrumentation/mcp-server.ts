import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  type ListResourcesRequest,
  ListResourcesRequestSchema,
  type ListToolsRequest,
  ListToolsRequestSchema,
  type ReadResourceRequest,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { getLogServer } from './logging';
import { ToolRegistry } from './tool-registry';
import { allTools } from './tools';

/**
 * MCP Server for desktop app instrumentation.
 * Provides tools for UI automation, state inspection, and logging.
 */
export class InstrumentationMcpServer {
  private server: Server;
  private toolRegistry: ToolRegistry;
  private transport: StdioServerTransport | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'agent-base-desktop',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.toolRegistry = new ToolRegistry();
    this.registerAllTools();
    this.setupHandlers();
  }

  private registerAllTools(): void {
    for (const tool of allTools) {
      this.toolRegistry.register(tool);
    }
    console.log(`[MCP] Registered ${this.toolRegistry.size} tools`);
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async (_request: ListToolsRequest) => {
      const tools = this.toolRegistry.getAll().map((tool) => ({
        name: tool.name,
        description: tool.description,
        // biome-ignore lint/suspicious/noExplicitAny: zod-to-json-schema typing compatibility
        inputSchema: zodToJsonSchema(tool.inputSchema as any) as Record<string, unknown>,
      }));

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;
      const tool = this.toolRegistry.get(name);

      if (!tool) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
          isError: true,
        };
      }

      try {
        // Validate input against schema
        const validatedInput = tool.inputSchema.parse(args ?? {});

        // Log the tool call
        getLogServer().log('info', 'mcp', `Tool called: ${name}`, {
          tool: name,
          args: validatedInput,
        });

        // Execute the tool
        const result = await tool.handler(validatedInput);

        // Check if result contains image data (for screenshot tool)
        if (
          typeof result === 'object' &&
          result !== null &&
          'image' in result &&
          typeof (result as { image?: { data?: string; mimeType?: string } }).image === 'object'
        ) {
          const imageResult = result as {
            success: boolean;
            image: { data: string; mimeType: string; width: number; height: number };
          };
          return {
            content: [
              {
                type: 'image' as const,
                data: imageResult.image.data,
                mimeType: imageResult.image.mimeType,
              },
              {
                type: 'text' as const,
                text: JSON.stringify({
                  success: imageResult.success,
                  width: imageResult.image.width,
                  height: imageResult.image.height,
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        getLogServer().log('error', 'mcp', `Tool error: ${name}`, {
          tool: name,
          error: errorMessage,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: errorMessage }),
            },
          ],
          isError: true,
        };
      }
    });

    // List available resources
    this.server.setRequestHandler(
      ListResourcesRequestSchema,
      async (_request: ListResourcesRequest) => {
        return {
          resources: [
            {
              uri: 'app://state',
              name: 'Application State',
              description: 'Current application state snapshot',
              mimeType: 'application/json',
            },
            {
              uri: 'app://logs',
              name: 'Application Logs',
              description: 'Recent application logs',
              mimeType: 'application/json',
            },
          ],
        };
      }
    );

    // Read resources
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request: ReadResourceRequest) => {
        const { uri } = request.params;

        if (uri === 'app://logs') {
          const logs = getLogServer().read({ limit: 100 });
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(logs, null, 2),
              },
            ],
          };
        }

        if (uri === 'app://state') {
          // State is retrieved through renderer, return placeholder
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  note: 'Use state_get tool to query specific state paths',
                }),
              },
            ],
          };
        }

        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Unknown resource: ${uri}`,
            },
          ],
        };
      }
    );
  }

  async start(): Promise<void> {
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);
    console.log('[MCP] Server started on stdio');
  }

  async stop(): Promise<void> {
    if (this.transport) {
      await this.server.close();
      this.transport = null;
    }
    console.log('[MCP] Server stopped');
  }
}

// Singleton instance
let mcpServerInstance: InstrumentationMcpServer | null = null;

export function getMcpServer(): InstrumentationMcpServer {
  if (!mcpServerInstance) {
    mcpServerInstance = new InstrumentationMcpServer();
  }
  return mcpServerInstance;
}

export async function startMcpServer(): Promise<void> {
  const server = getMcpServer();
  await server.start();
}

export async function stopMcpServer(): Promise<void> {
  if (mcpServerInstance) {
    await mcpServerInstance.stop();
    mcpServerInstance = null;
  }
}
