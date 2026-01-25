/**
 * Test Bridge - Renderer-side handler for MCP instrumentation requests.
 *
 * This module provides DOM access and state manipulation capabilities
 * that are invoked from the main process MCP server.
 */

import { getExposeRegistry } from '@agent-orchestrator/shared';

type RequestHandler = (payload: unknown) => Promise<unknown>;

interface BridgeRequest {
  requestId: string;
  channel: string;
  payload: unknown;
}

// Store for state access - will be set by the app
type StateGetter = (path?: string) => unknown;
type StateSetter = (path: string, value: unknown) => unknown;

let stateGetter: StateGetter | null = null;
let stateSetter: StateSetter | null = null;

// Canvas control functions - will be set by the canvas component
type CanvasAddNode = (params: {
  type: string;
  x: number;
  y: number;
  data?: Record<string, unknown>;
}) => Promise<{ nodeId: string; node: unknown }>;

type CanvasRemoveNode = (nodeId: string) => Promise<boolean>;

type CanvasConnect = (params: {
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
}) => Promise<{ edgeId: string; edge: unknown }>;

type CanvasQuery = (nodeId?: string) => {
  node?: unknown;
  nodes?: unknown[];
  edges?: unknown[];
  viewport?: { x: number; y: number; zoom: number };
};

let canvasAddNode: CanvasAddNode | null = null;
let canvasRemoveNode: CanvasRemoveNode | null = null;
let canvasConnect: CanvasConnect | null = null;
let canvasQuery: CanvasQuery | null = null;

/**
 * Register state access functions (called by app initialization)
 */
export function registerStateAccessors(getter: StateGetter, setter: StateSetter): void {
  stateGetter = getter;
  stateSetter = setter;
}

/**
 * Register canvas control functions (called by canvas component)
 */
export function registerCanvasControls(controls: {
  addNode: CanvasAddNode;
  removeNode: CanvasRemoveNode;
  connect: CanvasConnect;
  query: CanvasQuery;
}): void {
  canvasAddNode = controls.addNode;
  canvasRemoveNode = controls.removeNode;
  canvasConnect = controls.connect;
  canvasQuery = controls.query;
}

// Request handlers
const handlers: Record<string, RequestHandler> = {
  // Click handler
  'test-bridge:click': async (payload) => {
    const params = payload as {
      selector?: string;
      text?: string;
      x?: number;
      y?: number;
      button?: 'left' | 'right' | 'middle';
      doubleClick?: boolean;
    };

    let element: Element | null = null;
    let clickX: number;
    let clickY: number;

    if (params.selector) {
      element = document.querySelector(params.selector);
      if (!element) {
        return { success: false, error: `Element not found: ${params.selector}` };
      }
    } else if (params.text) {
      // Find element by text content
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node: Node | null = walker.nextNode();
      while (node !== null) {
        if (node.textContent?.includes(params.text)) {
          element = node.parentElement;
          break;
        }
        node = walker.nextNode();
      }
      if (!element) {
        return { success: false, error: `Element with text not found: ${params.text}` };
      }
    }

    if (element) {
      const rect = element.getBoundingClientRect();
      clickX = rect.x + rect.width / 2;
      clickY = rect.y + rect.height / 2;
    } else if (params.x !== undefined && params.y !== undefined) {
      clickX = params.x;
      clickY = params.y;
    } else {
      return { success: false, error: 'No click target specified' };
    }

    // Create and dispatch mouse events
    const eventInit: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      clientX: clickX,
      clientY: clickY,
      button: params.button === 'right' ? 2 : params.button === 'middle' ? 1 : 0,
    };

    const targetElement = element ?? document.elementFromPoint(clickX, clickY);
    if (!targetElement) {
      return { success: false, error: 'No element at click position' };
    }

    targetElement.dispatchEvent(new MouseEvent('mousedown', eventInit));
    targetElement.dispatchEvent(new MouseEvent('mouseup', eventInit));
    targetElement.dispatchEvent(new MouseEvent('click', eventInit));

    if (params.doubleClick) {
      targetElement.dispatchEvent(new MouseEvent('dblclick', eventInit));
    }

    return { success: true, x: clickX, y: clickY };
  },

  // Type handler
  'test-bridge:type': async (payload) => {
    const params = payload as {
      text: string;
      selector?: string;
      clear?: boolean;
      delay?: number;
    };

    let element: Element | HTMLInputElement | HTMLTextAreaElement;

    if (params.selector) {
      const found = document.querySelector(params.selector);
      if (!found) {
        return { success: false, error: `Element not found: ${params.selector}` };
      }
      element = found as HTMLInputElement;
    } else {
      const active = document.activeElement;
      if (!active || active === document.body) {
        return { success: false, error: 'No element is focused' };
      }
      element = active as HTMLInputElement;
    }

    // Check if element is an input or textarea
    if ('value' in element) {
      if (params.clear) {
        element.value = '';
      }
      element.value += params.text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      return { success: false, error: 'Element is not an input or textarea' };
    }

    return { success: true };
  },

  // Query handler
  'test-bridge:query': async (payload) => {
    const params = payload as {
      selector: string;
      properties?: string[];
      all?: boolean;
    };

    const getElementInfo = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const computed = window.getComputedStyle(el);

      const info: Record<string, unknown> = {
        exists: true,
        tagName: el.tagName.toLowerCase(),
        id: el.id || undefined,
        className: el.className || undefined,
        textContent: el.textContent?.trim().slice(0, 200),
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        visible: computed.display !== 'none' && computed.visibility !== 'hidden',
        enabled: !(el as HTMLButtonElement).disabled,
      };

      if ('value' in el) {
        info.value = (el as HTMLInputElement).value;
      }

      // Get specific properties if requested
      if (params.properties) {
        info.properties = {};
        for (const prop of params.properties) {
          try {
            info.properties[prop] = (el as unknown as Record<string, unknown>)[prop];
          } catch {
            // Ignore inaccessible properties
          }
        }
      }

      // Get attributes
      info.attributes = {};
      for (const attr of el.attributes) {
        (info.attributes as Record<string, string>)[attr.name] = attr.value;
      }

      return info;
    };

    if (params.all) {
      const elements = document.querySelectorAll(params.selector);
      if (elements.length === 0) {
        return { success: true, elements: [] };
      }
      return {
        success: true,
        elements: Array.from(elements).map(getElementInfo),
      };
    }

    const element = document.querySelector(params.selector);
    if (!element) {
      return { success: true, element: { exists: false } };
    }

    return { success: true, element: getElementInfo(element) };
  },

  // State get handler
  'test-bridge:state-get': async (payload) => {
    const params = payload as { path?: string };

    if (!stateGetter) {
      return { success: false, error: 'State getter not registered' };
    }

    try {
      const value = stateGetter(params.path);
      return { success: true, value };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'State get failed',
      };
    }
  },

  // State set handler
  'test-bridge:state-set': async (payload) => {
    const params = payload as { path: string; value: unknown };

    if (!stateSetter) {
      return { success: false, error: 'State setter not registered' };
    }

    try {
      const previousValue = stateGetter?.(params.path);
      stateSetter(params.path, params.value);
      return { success: true, previousValue };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'State set failed',
      };
    }
  },

  // Canvas add node handler
  'test-bridge:canvas-add-node': async (payload) => {
    const params = payload as {
      type: string;
      x: number;
      y: number;
      data?: Record<string, unknown>;
    };

    if (!canvasAddNode) {
      return { success: false, error: 'Canvas controls not registered' };
    }

    try {
      const result = await canvasAddNode(params);
      return { success: true, nodeId: result.nodeId, node: result.node };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Add node failed',
      };
    }
  },

  // Canvas remove node handler
  'test-bridge:canvas-remove-node': async (payload) => {
    const params = payload as { nodeId: string };

    if (!canvasRemoveNode) {
      return { success: false, error: 'Canvas controls not registered' };
    }

    try {
      const removed = await canvasRemoveNode(params.nodeId);
      return { success: true, removed };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Remove node failed',
      };
    }
  },

  // Canvas connect handler
  'test-bridge:canvas-connect': async (payload) => {
    const params = payload as {
      sourceNodeId: string;
      targetNodeId: string;
      sourceHandle?: string;
      targetHandle?: string;
    };

    if (!canvasConnect) {
      return { success: false, error: 'Canvas controls not registered' };
    }

    try {
      const result = await canvasConnect(params);
      return { success: true, edgeId: result.edgeId, edge: result.edge };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connect failed',
      };
    }
  },

  // Canvas query handler
  'test-bridge:canvas-query': async (payload) => {
    const params = payload as { nodeId?: string };

    if (!canvasQuery) {
      return { success: false, error: 'Canvas controls not registered' };
    }

    try {
      const result = canvasQuery(params.nodeId);
      return { success: true, ...result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed',
      };
    }
  },

  // ============================================================================
  // Automation handlers (expose_* tools)
  // ============================================================================

  // List all exposed components
  'automation:list': async (payload) => {
    const params = payload as { filter?: { tag?: string } };
    const registry = getExposeRegistry();

    try {
      const entries = registry.list(params.filter);
      return { success: true, entries };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'List failed',
      };
    }
  },

  // Get a value from an exposed component
  'automation:get': async (payload) => {
    const params = payload as { id: string; key: string };
    const registry = getExposeRegistry();

    const result = registry.get(params.id, params.key);
    return result;
  },

  // Set a value on an exposed component
  'automation:set': async (payload) => {
    const params = payload as { id: string; key: string; value: unknown };
    const registry = getExposeRegistry();

    const result = registry.set(params.id, params.key, params.value);
    return result;
  },

  // Call an action on an exposed component
  'automation:call': async (payload) => {
    const params = payload as { id: string; key: string; args?: unknown[] };
    const registry = getExposeRegistry();

    const result = registry.call(params.id, params.key, params.args ?? []);
    return result;
  },
};

// Declare the electronAPI type extension for MCP bridge
declare global {
  interface Window {
    electronAPI?: {
      onMcpBridgeRequest?: (callback: (request: BridgeRequest) => void) => void;
      sendMcpBridgeResponse?: (response: {
        requestId: string;
        result?: unknown;
        error?: string;
      }) => void;
    };
  }
}

/**
 * Initialize the test bridge.
 * This sets up listeners for requests from the main process.
 */
export function initTestBridge(): void {
  // Check if MCP bridge is available
  if (!window.electronAPI?.onMcpBridgeRequest) {
    console.log('[TestBridge] MCP bridge not available, skipping initialization');
    return;
  }

  // Listen for requests from main process
  window.electronAPI.onMcpBridgeRequest(async (request: BridgeRequest) => {
    const { requestId, channel, payload } = request;

    const handler = handlers[channel];
    if (!handler) {
      window.electronAPI?.sendMcpBridgeResponse?.({
        requestId,
        error: `Unknown channel: ${channel}`,
      });
      return;
    }

    try {
      const result = await handler(payload);
      window.electronAPI?.sendMcpBridgeResponse?.({
        requestId,
        result,
      });
    } catch (error) {
      window.electronAPI?.sendMcpBridgeResponse?.({
        requestId,
        error: error instanceof Error ? error.message : 'Handler error',
      });
    }
  });

  console.log('[TestBridge] Initialized');
}
