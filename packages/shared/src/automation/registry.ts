/**
 * ExposeRegistry
 *
 * Central registry for exposed component bindings.
 * Designed like console.log - embarrassingly simple to use.
 *
 * Usage:
 *   registry.register('chat-input', { value, setValue, send });
 *   registry.get('chat-input', 'value');
 *   registry.call('chat-input', 'send', []);
 */

import type {
  AutomationTransport,
  Bindings,
  BindingValue,
  CallResult,
  ExposeEntry,
  ExposeInfo,
  GetResult,
  SetResult,
} from './types.js';

export class ExposeRegistry {
  private entries = new Map<string, ExposeEntry>();
  private transport: AutomationTransport | null = null;

  /**
   * Set the transport for external communication
   */
  setTransport(transport: AutomationTransport | null): void {
    this.transport = transport;
  }

  /**
   * Register bindings for a component.
   * Returns an unregister function (for cleanup on unmount).
   */
  register(id: string, bindings: Bindings, tags: string[] = []): () => void {
    if (this.entries.has(id)) {
      // Update existing entry (allows hot reload / re-render)
      const existing = this.entries.get(id)!;
      existing.bindings = bindings;
      existing.tags = tags;
      return () => this.unregister(id);
    }

    const entry: ExposeEntry = {
      id,
      bindings,
      tags,
      registeredAt: Date.now(),
    };

    this.entries.set(id, entry);
    this.transport?.onRegister?.(this.toInfo(entry));

    return () => this.unregister(id);
  }

  /**
   * Unregister bindings
   */
  unregister(id: string): void {
    if (this.entries.delete(id)) {
      this.transport?.onUnregister?.(id);
    }
  }

  /**
   * List all registered entries
   */
  list(filter?: { tag?: string }): ExposeInfo[] {
    const results: ExposeInfo[] = [];

    for (const entry of this.entries.values()) {
      if (filter?.tag && !entry.tags.includes(filter.tag)) {
        continue;
      }
      results.push(this.toInfo(entry));
    }

    return results;
  }

  /**
   * Get a value from an exposed binding
   */
  get(id: string, key: string): GetResult {
    const entry = this.entries.get(id);
    if (!entry) {
      return { success: false, error: `Not found: ${id}` };
    }

    const binding = entry.bindings[key];
    if (binding === undefined) {
      return {
        success: false,
        error: `Key not found: ${key}. Available: ${Object.keys(entry.bindings).join(', ')}`,
      };
    }

    try {
      const value = this.resolveValue(binding);
      return { success: true, value };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Set a value on an exposed binding
   */
  set(id: string, key: string, value: unknown): SetResult {
    const entry = this.entries.get(id);
    if (!entry) {
      return { success: false, error: `Not found: ${id}` };
    }

    const binding = entry.bindings[key];
    if (binding === undefined) {
      return {
        success: false,
        error: `Key not found: ${key}. Available: ${Object.keys(entry.bindings).join(', ')}`,
      };
    }

    try {
      // Check if it's an accessor with set
      if (this.isAccessor(binding)) {
        binding.set(value);
        return { success: true };
      }

      // Check if it's a setter function (naming convention: setXxx where X is uppercase)
      // This avoids false positives like setup(), settings(), setInterval()
      if (typeof binding === 'function' && /^set[A-Z]/.test(key)) {
        binding(value);
        return { success: true };
      }

      return {
        success: false,
        error: `Key "${key}" is not settable. Use an accessor or setXxx function.`,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Call an exposed action
   */
  call(id: string, key: string, args: unknown[] = []): CallResult | Promise<CallResult> {
    const entry = this.entries.get(id);
    if (!entry) {
      return { success: false, error: `Not found: ${id}` };
    }

    const binding = entry.bindings[key];
    if (binding === undefined) {
      return {
        success: false,
        error: `Key not found: ${key}. Available: ${Object.keys(entry.bindings).join(', ')}`,
      };
    }

    if (typeof binding !== 'function') {
      return {
        success: false,
        error: `Key "${key}" is not callable. It's a ${typeof binding}.`,
      };
    }

    try {
      const result = binding(...args);
      // Handle async functions
      if (result instanceof Promise) {
        return result
          .then((r): CallResult => ({ success: true, result: r }))
          .catch((err): CallResult => ({ success: false, error: String(err) }));
      }
      return { success: true, result };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Check if an entry exists
   */
  has(id: string): boolean {
    return this.entries.has(id);
  }

  /**
   * Get raw entry (for advanced use)
   */
  getEntry(id: string): ExposeEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Handle incoming request (used by transports)
   */
  async handleRequest(
    request:
      | { type: 'list'; filter?: { tag?: string } }
      | { type: 'get'; id: string; key: string }
      | { type: 'set'; id: string; key: string; value: unknown }
      | { type: 'call'; id: string; key: string; args?: unknown[] }
  ): Promise<
    | { type: 'list'; entries: ExposeInfo[] }
    | { type: 'get'; result: GetResult }
    | { type: 'set'; result: SetResult }
    | { type: 'call'; result: CallResult }
  > {
    switch (request.type) {
      case 'list':
        return { type: 'list', entries: this.list(request.filter) };
      case 'get':
        return { type: 'get', result: this.get(request.id, request.key) };
      case 'set':
        return { type: 'set', result: this.set(request.id, request.key, request.value) };
      case 'call':
        return { type: 'call', result: await this.call(request.id, request.key, request.args) };
    }
  }

  private toInfo(entry: ExposeEntry): ExposeInfo {
    return {
      id: entry.id,
      keys: Object.keys(entry.bindings),
      tags: entry.tags,
      registeredAt: entry.registeredAt,
    };
  }

  private isAccessor(
    binding: BindingValue
  ): binding is { get: () => unknown; set: (value: unknown) => void } {
    return (
      typeof binding === 'object' &&
      binding !== null &&
      'get' in binding &&
      'set' in binding &&
      typeof binding.get === 'function' &&
      typeof binding.set === 'function'
    );
  }

  private resolveValue(binding: BindingValue): unknown {
    // Accessor: call get()
    if (this.isAccessor(binding)) {
      return binding.get();
    }
    // Function: return the function itself (don't call it)
    if (typeof binding === 'function') {
      return '[Function]';
    }
    // Primitive: return as-is
    return binding;
  }
}

// Singleton instance
let registryInstance: ExposeRegistry | null = null;

/**
 * Get the global ExposeRegistry singleton
 */
export function getExposeRegistry(): ExposeRegistry {
  if (!registryInstance) {
    registryInstance = new ExposeRegistry();
  }
  return registryInstance;
}

/**
 * Reset the registry (for testing)
 */
export function resetExposeRegistry(): void {
  registryInstance?.clear();
  registryInstance = null;
}
