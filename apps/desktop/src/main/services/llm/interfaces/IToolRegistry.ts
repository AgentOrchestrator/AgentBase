import type { LLMError, Result, ToolDefinition, ToolExecutor } from '../types';

/**
 * Registry for managing LLM tools.
 * Tools can be registered and later used in chat requests.
 */
export interface IToolRegistry {
  /**
   * Register a new tool
   * @param definition - Tool schema and metadata
   * @param executor - Function to execute the tool
   */
  register(definition: ToolDefinition, executor: ToolExecutor): Result<void, LLMError>;

  /**
   * Unregister a tool by name
   * @param name - Tool name to remove
   */
  unregister(name: string): Result<void, LLMError>;

  /**
   * Get all registered tool definitions (for LLM context)
   */
  getDefinitions(): ToolDefinition[];

  /**
   * Get tool definitions filtered by names
   * @param names - Tool names to retrieve
   */
  getDefinitionsByNames(names: string[]): ToolDefinition[];

  /**
   * Execute a tool by name with given arguments
   * @param name - Tool name
   * @param args - Arguments to pass to the tool
   */
  execute(name: string, args: Record<string, unknown>): Promise<Result<unknown, LLMError>>;

  /**
   * Check if a tool is registered
   * @param name - Tool name
   */
  has(name: string): boolean;

  /**
   * Clear all registered tools
   */
  clear(): void;
}
