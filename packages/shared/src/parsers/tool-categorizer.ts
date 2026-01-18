/**
 * Tool categorization utilities
 */

import type { ToolCategory } from '../loaders/types.js';

/**
 * Categorize a tool by its name
 *
 * @param name - Tool name (e.g., "Read", "Bash", "WebFetch")
 * @returns The tool category
 */
export function categorizeToolByName(name: string): ToolCategory {
  const lowerName = name.toLowerCase();

  // File read operations
  if (['read', 'cat', 'head', 'tail'].some((t) => lowerName.includes(t))) {
    return 'file_read';
  }

  // File write operations
  if (['write', 'edit', 'touch'].some((t) => lowerName.includes(t))) {
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

  // Code intelligence operations
  if (['lsp', 'definition', 'reference', 'hover'].some((t) => lowerName.includes(t))) {
    return 'code_intel';
  }

  // MCP tools
  if (lowerName.startsWith('mcp')) {
    return 'mcp';
  }

  return 'custom';
}
