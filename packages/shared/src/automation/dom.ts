/**
 * DOM Binding Helpers
 *
 * For third-party or uncontrolled components where we can't access
 * React state directly. These helpers create accessor bindings that
 * read/write through the DOM with proper event dispatching.
 *
 * NOTE: These helpers are browser-only. They will no-op in Node.js environments.
 */

/// <reference lib="dom" />

import type { RefObject } from 'react';

/**
 * Accessor binding for read/write through DOM
 */
export interface DomAccessor {
  get: () => unknown;
  set: (value: unknown) => void;
}

/**
 * Create a DOM-backed accessor for a ref.
 *
 * Reads and writes through the DOM element, dispatching proper events
 * so React/libraries can respond to changes.
 *
 * @param ref - React ref to the DOM element
 * @param property - Property to read/write (default: 'value')
 *
 * @example
 * // For an uncontrolled input
 * const inputRef = useRef<HTMLInputElement>(null);
 * useExpose('search-box', {
 *   query: domBinding(inputRef),
 * });
 *
 * @example
 * // For contentEditable elements
 * const editorRef = useRef<HTMLDivElement>(null);
 * useExpose('rich-editor', {
 *   content: domBinding(editorRef, 'innerText'),
 * });
 */
export function domBinding(
  ref: RefObject<HTMLElement | null>,
  property: 'value' | 'innerText' | 'innerHTML' | 'textContent' = 'value'
): DomAccessor {
  return {
    get: () => {
      const el = ref.current;
      // Return null when element is not mounted (explicit "no value" sentinel)
      if (!el) return null;
      return (el as unknown as Record<string, unknown>)[property];
    },
    set: (value: unknown) => {
      const el = ref.current;
      if (!el) return;

      // Focus the element first (some libraries require this)
      el.focus();

      // Set the value
      (el as unknown as Record<string, unknown>)[property] = value;

      // Dispatch events that React and other libraries listen to
      // The order matters: input first, then change
      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          data: String(value),
        })
      );
      el.dispatchEvent(
        new Event('change', {
          bubbles: true,
          cancelable: true,
        })
      );
    },
  };
}

/**
 * Create a click action for a DOM element.
 *
 * @param ref - React ref to the clickable element
 *
 * @example
 * const buttonRef = useRef<HTMLButtonElement>(null);
 * useExpose('submit-form', {
 *   click: domClick(buttonRef),
 * });
 */
export function domClick(ref: RefObject<HTMLElement | null>): () => void {
  return () => {
    const el = ref.current;
    if (!el) return;

    el.click();
  };
}

/**
 * Create a focus action for a DOM element.
 *
 * @param ref - React ref to the focusable element
 */
export function domFocus(ref: RefObject<HTMLElement | null>): () => void {
  return () => {
    ref.current?.focus();
  };
}

/**
 * Create a blur action for a DOM element.
 *
 * @param ref - React ref to the element
 */
export function domBlur(ref: RefObject<HTMLElement | null>): () => void {
  return () => {
    ref.current?.blur();
  };
}

/**
 * Create a scroll action for a DOM element.
 *
 * @param ref - React ref to the scrollable element
 *
 * @example
 * const listRef = useRef<HTMLDivElement>(null);
 * useExpose('message-list', {
 *   scrollToBottom: domScrollToBottom(listRef),
 *   scrollTo: domScrollTo(listRef),
 * });
 */
export function domScrollToBottom(ref: RefObject<HTMLElement | null>): () => void {
  return () => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };
}

export function domScrollToTop(ref: RefObject<HTMLElement | null>): () => void {
  return () => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = 0;
  };
}

export function domScrollTo(
  ref: RefObject<HTMLElement | null>
): (options: { top?: number; left?: number; behavior?: ScrollBehavior }) => void {
  return (options) => {
    ref.current?.scrollTo(options);
  };
}

/**
 * Create a selector for querying DOM state.
 *
 * @param ref - React ref to the container element
 * @param selector - CSS selector to query
 *
 * @example
 * const containerRef = useRef<HTMLDivElement>(null);
 * useExpose('form', {
 *   // Get all checked checkboxes
 *   checkedItems: domQuery(containerRef, 'input[type="checkbox"]:checked', el => el.value),
 * });
 */
export function domQuery<T>(
  ref: RefObject<HTMLElement | null>,
  selector: string,
  mapper?: (el: Element) => T
): { get: () => T[]; set: () => void } {
  return {
    get: () => {
      const el = ref.current;
      if (!el) return [];
      const elements = el.querySelectorAll(selector);
      const mapFn = mapper ?? ((e: Element) => e as unknown as T);
      return Array.from(elements).map(mapFn);
    },
    set: () => {
      // Read-only - no-op for set
    },
  };
}
