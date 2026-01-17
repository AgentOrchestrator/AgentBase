import type { z } from 'zod';

/**
 * Definition of a tool that can be registered with the LLM service
 */
export interface ToolDefinition {
  /** Unique name for the tool */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** Zod schema defining the tool's parameters */
  parameters: z.ZodType<unknown>;
}

/**
 * A tool call requested by the model
 */
export interface ToolCall {
  /** Unique identifier for this tool call */
  id: string;
  /** Name of the tool to execute */
  name: string;
  /** Arguments to pass to the tool */
  arguments: Record<string, unknown>;
}

/**
 * Result of executing a tool
 */
export interface ToolResult {
  /** ID of the tool call this result is for */
  toolCallId: string;
  /** Result data from the tool */
  result: unknown;
  /** Error message if execution failed */
  error?: string;
}

/**
 * Function that executes a tool
 */
export type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>;
