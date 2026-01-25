/**
 * Desktop App Instrumentation Module
 *
 * This module provides MCP server integration for E2E testing and automation.
 * When the app is started with --mcp flag, it runs as an MCP server that
 * Claude Code can connect to for automated testing.
 *
 * Usage:
 *   npm run dev:mcp  - Start app in MCP server mode
 *
 * MCP Configuration:
 *   Add to .mcp.json or claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "agent-base": {
 *         "command": "npm",
 *         "args": ["run", "dev:mcp"],
 *         "cwd": "/path/to/agent-orchestrator"
 *       }
 *     }
 *   }
 */

export { disposeIpcBridge, getIpcBridge, IpcBridge } from './ipc-bridge';
export {
  disposeLogServer,
  getLogServer,
  type LogEntry,
  type LogLevel,
  LogServer,
  type LogSource,
  RingBuffer,
} from './logging';
export {
  getMcpServer,
  InstrumentationMcpServer,
  startMcpServer,
  stopMcpServer,
} from './mcp-server';
export { type Tool, ToolRegistry } from './tool-registry';
export { allTools } from './tools';

/**
 * Check if the app was started in MCP mode
 */
export function isMcpMode(): boolean {
  return process.argv.includes('--mcp');
}
