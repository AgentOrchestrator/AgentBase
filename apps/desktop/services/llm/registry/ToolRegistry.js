"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
const types_1 = require("../types");
/**
 * In-memory registry for LLM tools.
 * Tools can be registered at startup or dynamically added.
 */
class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }
    register(definition, executor) {
        if (this.tools.has(definition.name)) {
            return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.TOOL_ALREADY_REGISTERED, `Tool "${definition.name}" is already registered`));
        }
        this.tools.set(definition.name, { definition, executor });
        return (0, types_1.ok)(undefined);
    }
    unregister(name) {
        if (!this.tools.has(name)) {
            return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.TOOL_NOT_FOUND, `Tool "${name}" is not registered`));
        }
        this.tools.delete(name);
        return (0, types_1.ok)(undefined);
    }
    getDefinitions() {
        return Array.from(this.tools.values()).map((t) => t.definition);
    }
    getDefinitionsByNames(names) {
        return names
            .filter((name) => this.tools.has(name))
            .map((name) => this.tools.get(name).definition);
    }
    async execute(name, args) {
        const tool = this.tools.get(name);
        if (!tool) {
            return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.TOOL_NOT_FOUND, `Tool "${name}" is not registered`));
        }
        try {
            const result = await tool.executor(args);
            return (0, types_1.ok)(result);
        }
        catch (error) {
            return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.TOOL_EXECUTION_FAILED, `Tool "${name}" execution failed: ${error.message}`, { args }, error instanceof Error ? error : undefined));
        }
    }
    has(name) {
        return this.tools.has(name);
    }
    clear() {
        this.tools.clear();
    }
}
exports.ToolRegistry = ToolRegistry;
