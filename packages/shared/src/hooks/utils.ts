/**
 * Shared utilities for agent hooks
 */

import type { ToolCategory } from '../loaders/types.js';

/**
 * Categorize a tool name to its ToolCategory
 *
 * This is the canonical implementation used across all adapters
 * to ensure consistent tool categorization.
 *
 * @param toolName - The name of the tool (e.g., "Bash", "Read", "Glob")
 * @returns The category of the tool
 */
export function categorizeToolName(toolName: string): ToolCategory {
  const lowerName = toolName.toLowerCase();

  // File read operations
  if (['read', 'cat', 'head', 'tail'].some((t) => lowerName.includes(t))) {
    return 'file_read';
  }

  // File write operations
  if (['write', 'edit', 'touch', 'notebookedit'].some((t) => lowerName.includes(t))) {
    return 'file_write';
  }

  // File search operations
  if (['glob', 'grep', 'find', 'search'].some((t) => lowerName.includes(t))) {
    return 'file_search';
  }

  // Shell/terminal operations
  if (['bash', 'shell', 'terminal', 'exec'].some((t) => lowerName.includes(t))) {
    return 'shell';
  }

  // Web operations
  if (['web', 'fetch', 'http', 'url'].some((t) => lowerName.includes(t))) {
    return 'web';
  }

  // Code intelligence (LSP)
  if (['lsp', 'definition', 'reference', 'hover'].some((t) => lowerName.includes(t))) {
    return 'code_intel';
  }

  // MCP tools
  if (
    lowerName.startsWith('mcp_') ||
    lowerName.startsWith('mcp__') ||
    lowerName.startsWith('mcp')
  ) {
    return 'mcp';
  }

  return 'unknown';
}
