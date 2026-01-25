import type { z } from 'zod';

/**
 * Definition of an MCP tool for the instrumentation system.
 * Using 'any' for type flexibility since tools have diverse input/output types.
 */
// biome-ignore lint/suspicious/noExplicitAny: Tool types need flexibility for diverse handlers
export interface Tool<TInput = any, TOutput = any> {
  name: string;
  description: string;
  // biome-ignore lint/suspicious/noExplicitAny: Zod schema types vary across tools
  inputSchema: z.ZodType<TInput, any, any>;
  handler: (params: TInput) => Promise<TOutput>;
}

/**
 * Registry for MCP tools. Allows dynamic registration and lookup.
 */
export class ToolRegistry {
  // biome-ignore lint/suspicious/noExplicitAny: Tool registry stores diverse tool types
  private tools: Map<string, Tool<any, any>> = new Map();

  // biome-ignore lint/suspicious/noExplicitAny: Accepts tools with any input/output types
  register<TInput, TOutput>(tool: Tool<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Returns tools with any input/output types
  get(name: string): Tool<any, any> | undefined {
    return this.tools.get(name);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Returns array of tools with any types
  getAll(): Tool<any, any>[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  clear(): void {
    this.tools.clear();
  }

  get size(): number {
    return this.tools.size;
  }
}
