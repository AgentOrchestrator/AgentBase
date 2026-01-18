import type { IToolRegistry } from '../interfaces';
import type { LLMError, Result, ToolDefinition, ToolExecutor } from '../types';
import { err, LLMErrorCode, llmError, ok } from '../types';

interface RegisteredTool {
  definition: ToolDefinition;
  executor: ToolExecutor;
}

/**
 * In-memory registry for LLM tools.
 * Tools can be registered at startup or dynamically added.
 */
export class ToolRegistry implements IToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register(definition: ToolDefinition, executor: ToolExecutor): Result<void, LLMError> {
    if (this.tools.has(definition.name)) {
      return err(
        llmError(
          LLMErrorCode.TOOL_ALREADY_REGISTERED,
          `Tool "${definition.name}" is already registered`
        )
      );
    }

    this.tools.set(definition.name, { definition, executor });
    return ok(undefined);
  }

  unregister(name: string): Result<void, LLMError> {
    if (!this.tools.has(name)) {
      return err(llmError(LLMErrorCode.TOOL_NOT_FOUND, `Tool "${name}" is not registered`));
    }

    this.tools.delete(name);
    return ok(undefined);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  getDefinitionsByNames(names: string[]): ToolDefinition[] {
    return names
      .map((name) => this.tools.get(name)?.definition)
      .filter((def): def is ToolDefinition => def !== undefined);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<Result<unknown, LLMError>> {
    const tool = this.tools.get(name);
    if (!tool) {
      return err(llmError(LLMErrorCode.TOOL_NOT_FOUND, `Tool "${name}" is not registered`));
    }

    try {
      const result = await tool.executor(args);
      return ok(result);
    } catch (error) {
      return err(
        llmError(
          LLMErrorCode.TOOL_EXECUTION_FAILED,
          `Tool "${name}" execution failed: ${(error as Error).message}`,
          { args },
          error instanceof Error ? error : undefined
        )
      );
    }
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  clear(): void {
    this.tools.clear();
  }
}
