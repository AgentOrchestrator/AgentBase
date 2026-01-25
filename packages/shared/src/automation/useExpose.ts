/**
 * useExpose Hook
 *
 * The "console.log" of automation - embarrassingly simple to use.
 *
 * Usage:
 *   useExpose('chat-input', { value, setValue, send });
 *
 * The hook automatically:
 * - Registers on mount
 * - Unregisters on unmount
 * - Keeps bindings fresh (always calls latest handlers)
 */

import { useEffect, useId, useRef } from 'react';
import { getExposeRegistry } from './registry.js';
import type { Bindings } from './types.js';

/**
 * Expose component bindings for automation.
 *
 * @param id - Unique identifier for this component (e.g., 'chat-input', 'message-list:node-123')
 * @param bindings - Object of values, setters, and actions to expose
 * @param tags - Optional tags for filtering (like session IDs in logging)
 *
 * @example
 * // Basic usage - expose state and actions
 * function ChatInput({ onSend }) {
 *   const [value, setValue] = useState('');
 *
 *   useExpose('chat-input', { value, setValue, send: () => onSend(value) });
 *
 *   return <input value={value} onChange={e => setValue(e.target.value)} />;
 * }
 *
 * @example
 * // With tags for filtering
 * useExpose('chat-input', { value, send }, ['critical-path', `session:${sessionId}`]);
 *
 * @example
 * // Multiple instances - use unique ID
 * useExpose(`message-list:${nodeId}`, { messages, scrollToBottom });
 *
 * @example
 * // Accessor pattern for derived/computed state
 * useExpose('stats', {
 *   count: { get: () => items.length, set: () => {} },
 * });
 */
export function useExpose(id: string, bindings: Bindings, tags: string[] = []): void {
  // Keep bindings in ref so we always access the latest values
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  // Create a stable proxy that delegates to the ref
  const stableBindingsRef = useRef<Bindings | null>(null);
  if (!stableBindingsRef.current) {
    stableBindingsRef.current = new Proxy(
      {},
      {
        get(_target, prop: string) {
          return bindingsRef.current[prop];
        },
        ownKeys() {
          return Object.keys(bindingsRef.current);
        },
        getOwnPropertyDescriptor(_target, prop: string): PropertyDescriptor | undefined {
          // Per JS Proxy spec: return descriptor for existing props, undefined otherwise
          return prop in bindingsRef.current ? { enumerable: true, configurable: true } : undefined;
        },
        has(_target, prop: string) {
          return prop in bindingsRef.current;
        },
      }
    );
  }

  // Stable tags reference (only recreate if tags actually change)
  const tagsKey = tags.join('\0');
  const tagsRef = useRef(tags);
  if (tagsRef.current.join('\0') !== tagsKey) {
    tagsRef.current = tags;
  }

  useEffect(() => {
    const registry = getExposeRegistry();
    const unregister = registry.register(id, stableBindingsRef.current!, tagsRef.current);

    return unregister;
  }, [id, tagsKey]);
}

/**
 * Generate a unique expose ID for components that may have multiple instances.
 *
 * @param prefix - The component type prefix (e.g., 'message-list')
 * @returns A unique ID like 'message-list:r1a2b3'
 *
 * @example
 * function MessageList() {
 *   const exposeId = useExposeId('message-list');
 *   useExpose(exposeId, { messages, scrollToBottom });
 *   // ...
 * }
 */
export function useExposeId(prefix: string): string {
  const reactId = useId();
  // Clean up React's ID format (remove colons and 'r' prefix)
  const cleanId = reactId.replace(/:/g, '').replace(/^r/, '');
  return `${prefix}:${cleanId}`;
}

/**
 * Non-hook version for use outside React components.
 * Returns an unregister function.
 *
 * @example
 * // In a service or module
 * const unregister = expose('api-client', {
 *   isConnected: { get: () => client.connected, set: () => {} },
 *   reconnect: () => client.reconnect(),
 * });
 *
 * // Later, when cleaning up
 * unregister();
 */
export function expose(id: string, bindings: Bindings, tags: string[] = []): () => void {
  const registry = getExposeRegistry();
  return registry.register(id, bindings, tags);
}
