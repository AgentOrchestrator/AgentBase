import * as http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { z } from 'zod';
import { getLogServer } from './logging';
import { allTools } from './tools';

const MCP_PORT = 3100;

/**
 * MCP Server for desktop app instrumentation.
 * Provides tools for UI automation, state inspection, and logging.
 *
 * Uses stateless HTTP mode: each request gets a fresh McpServer instance.
 */
export class InstrumentationMcpServer {
  private httpServer: http.Server | null = null;

  /**
   * Create a fresh McpServer instance with all tools registered.
   * Called for each incoming HTTP request (stateless mode).
   */
  private createServer(): McpServer {
    const server = new McpServer({
      name: 'agent-base-desktop',
      version: '1.0.0',
    });

    this.registerTools(server);
    this.registerResources(server);

    return server;
  }

  private registerTools(server: McpServer): void {
    for (const tool of allTools) {
      // Cast to ZodObject to access .shape - all tools use z.object()
      // biome-ignore lint/suspicious/noExplicitAny: Schema shape types vary across tools
      const schemaShape = (tool.inputSchema as z.ZodObject<any>).shape;

      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: schemaShape,
        },
        // biome-ignore lint/suspicious/noExplicitAny: Tool args are validated at runtime
        async (args: any) => {
          try {
            // Validate input against schema
            const validatedInput = tool.inputSchema.parse(args);

            // Log the tool call
            getLogServer().log('info', 'mcp', `Tool called: ${tool.name}`, {
              tool: tool.name,
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
            getLogServer().log('error', 'mcp', `Tool error: ${tool.name}`, {
              tool: tool.name,
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
        }
      );
    }
    console.log(`[MCP] Registered ${allTools.length} tools`);
  }

  private registerResources(server: McpServer): void {
    // Register app state resource
    server.registerResource(
      'app-state',
      'app://state',
      {
        description: 'Current application state snapshot',
        mimeType: 'application/json',
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({
              note: 'Use state_get tool to query specific state paths',
            }),
          },
        ],
      })
    );

    // Register app logs resource
    server.registerResource(
      'app-logs',
      'app://logs',
      {
        description: 'Recent application logs',
        mimeType: 'application/json',
      },
      async (uri) => {
        const logs = getLogServer().read({ limit: 100 });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(logs, null, 2),
            },
          ],
        };
      }
    );
  }

  async start(): Promise<void> {
    // Create HTTP server
    this.httpServer = http.createServer(async (req, res) => {
      // Set CORS headers for local development
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');

      // Handle preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Only handle /mcp endpoint
      if (req.url !== '/mcp') {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      // Create fresh server and transport for this request (stateless mode)
      const mcpServer = this.createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
      });

      try {
        // Connect and handle the request
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res);

        // Cleanup when response closes
        res.on('close', async () => {
          try {
            await transport.close();
            await mcpServer.close();
          } catch (cleanupError) {
            console.error('[MCP] Error during cleanup:', cleanupError);
          }
        });
      } catch (error) {
        console.error('[MCP] Error handling request:', error);

        // Cleanup resources on error to prevent leaks
        try {
          await transport.close();
          await mcpServer.close();
        } catch (cleanupError) {
          console.error('[MCP] Error during error cleanup:', cleanupError);
        }

        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32603, message: 'Internal server error' },
              id: null,
            })
          );
        }
      }
    });

    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.httpServer!.on('error', reject);
      this.httpServer!.listen(MCP_PORT, () => {
        console.log(`[MCP] Server started on http://localhost:${MCP_PORT}/mcp`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = null;
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
