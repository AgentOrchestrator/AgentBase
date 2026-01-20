/**
 * NodeContext
 *
 * React Context for lifecycle-scoped node services.
 * Each node wraps its content with NodeContextProvider to get
 * type-appropriate services that are disposed on unmount.
 */

import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentType } from '../../../types/coding-agent-status';
import type { NodeServiceConfig } from './NodeServicesRegistry';
import { useNodeServicesRegistry } from './NodeServicesRegistry';
import type {
  IAgentService,
  IConversationService,
  ITerminalService,
  IWorkspaceService,
  NodeServices,
  NodeType,
} from './node-services';
import {
  hasAgentService,
  hasConversationService,
  hasTerminalService,
  hasWorkspaceService,
} from './node-services';

// =============================================================================
// Context Types
// =============================================================================

/**
 * Context value interface
 */
export interface NodeContextValue<T extends NodeServices = NodeServices> {
  /** Node ID */
  nodeId: string;
  /** Node type */
  nodeType: NodeType;
  /** Service bundle (type depends on nodeType) */
  services: T;
  /** Whether services are initialized */
  isInitialized: boolean;
  /** Error during initialization (if any) */
  error: Error | null;
}

// =============================================================================
// Context
// =============================================================================

const NodeContext = createContext<NodeContextValue | null>(null);

// =============================================================================
// Provider Props
// =============================================================================

export interface NodeContextProviderProps {
  /** Unique node ID */
  nodeId: string;
  /** Node type determines which services are available */
  nodeType: NodeType;
  /** Terminal ID (required for terminal/agent nodes) */
  terminalId?: string;
  /** Agent ID (required for agent nodes) */
  agentId?: string;
  /** Agent type (required for agent nodes) */
  agentType?: AgentType | string;
  /** Session ID (required for conversation nodes) */
  sessionId?: string;
  /** Workspace path */
  workspacePath?: string;
  /** Initial prompt to send to the agent when it starts */
  initialPrompt?: string;
  /** Child components */
  children: React.ReactNode;
}

// =============================================================================
// Provider Component
// =============================================================================

/**
 * NodeContextProvider
 *
 * Wraps a node component to provide lifecycle-scoped services.
 * Services are created on mount and disposed on unmount.
 */
export function NodeContextProvider({
  nodeId,
  nodeType,
  terminalId,
  agentId,
  agentType,
  sessionId,
  workspacePath,
  initialPrompt: _initialPrompt,
  children,
}: NodeContextProviderProps) {
  const registry = useNodeServicesRegistry();
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const servicesRef = useRef<NodeServices | null>(null);
  const isDisposingRef = useRef(false);

  // Memoize service config to prevent infinite re-renders
  // Without useMemo, config object is recreated on every render with a new reference,
  // causing the useEffect below to re-run infinitely
  const config = useMemo<NodeServiceConfig>(
    () => ({
      terminalId: terminalId || `terminal-${nodeId}`,
      agentId: agentId || `agent-${nodeId}`,
      agentType: (agentType as AgentType) || 'claude_code',
      sessionId,
      workspacePath,
    }),
    [terminalId, nodeId, agentId, agentType, sessionId, workspacePath]
  );

  // Track the previous workspace path to detect changes
  const prevWorkspacePathRef = useRef<string | undefined>(undefined);

  // Initialize services on mount
  useEffect(() => {
    let mounted = true;

    const initServices = async () => {
      try {
        // Get or create services from registry
        const services = registry.getOrCreateServices(nodeId, nodeType, config);
        servicesRef.current = services;

        // Initialize all services in the bundle
        const initPromises: Promise<void>[] = [];

        if (hasTerminalService(services)) {
          initPromises.push(services.terminal.initialize());
        }
        if (hasWorkspaceService(services)) {
          initPromises.push(services.workspace.initialize());
        }
        if (hasAgentService(services)) {
          initPromises.push(services.agent.initialize());
        }

        await Promise.all(initPromises);

        if (mounted) {
          setIsInitialized(true);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    initServices();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (!isDisposingRef.current) {
        isDisposingRef.current = true;
        registry.disposeServices(nodeId).catch((err) => {
          console.error(`[NodeContext] Error disposing services for ${nodeId}:`, err);
        });
      }
    };
  }, [nodeId, nodeType, registry, config]);

  // Handle workspace path changes after initialization
  useEffect(() => {
    // Skip if not initialized or no services
    if (!isInitialized || !servicesRef.current) {
      return;
    }

    // Skip if workspace path hasn't actually changed
    if (workspacePath === prevWorkspacePathRef.current) {
      return;
    }

    // Update the previous workspace path
    const previousPath = prevWorkspacePathRef.current;
    prevWorkspacePathRef.current = workspacePath;

    // Skip if there's no new workspace path
    if (!workspacePath) {
      return;
    }

    console.log(`[NodeContext] Workspace path changed: ${previousPath} -> ${workspacePath}`);
  }, [isInitialized, workspacePath]);

  // Build context value
  const contextValue: NodeContextValue | null = servicesRef.current
    ? {
        nodeId,
        nodeType,
        services: servicesRef.current,
        isInitialized,
        error,
      }
    : null;

  // Don't render children until we have services (even if not initialized)
  if (!contextValue) {
    return null;
  }

  return <NodeContext.Provider value={contextValue}>{children}</NodeContext.Provider>;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Access the full node context
 */
export function useNodeContext(): NodeContextValue {
  const context = useContext(NodeContext);
  if (!context) {
    throw new Error('useNodeContext must be used within NodeContextProvider');
  }
  return context;
}

/**
 * Access node services with type inference
 */
export function useNodeServices<T extends NodeServices = NodeServices>(): T {
  const context = useNodeContext();
  return context.services as T;
}

/**
 * Access terminal service (throws if not available)
 */
export function useTerminalService(): ITerminalService {
  const context = useNodeContext();
  if (!hasTerminalService(context.services)) {
    throw new Error(`Terminal service not available for node type: ${context.nodeType}`);
  }
  return context.services.terminal;
}

/**
 * Access workspace service (throws if not available)
 */
export function useWorkspaceService(): IWorkspaceService {
  const context = useNodeContext();
  if (!hasWorkspaceService(context.services)) {
    throw new Error(`Workspace service not available for node type: ${context.nodeType}`);
  }
  return context.services.workspace;
}

/**
 * Access agent service (throws if not available)
 */
export function useAgentService(): IAgentService {
  const context = useNodeContext();
  if (!hasAgentService(context.services)) {
    throw new Error(`Agent service not available for node type: ${context.nodeType}`);
  }
  return context.services.agent;
}

/**
 * Access conversation service (throws if not available)
 */
export function useConversationService(): IConversationService {
  const context = useNodeContext();
  if (!hasConversationService(context.services)) {
    throw new Error(`Conversation service not available for node type: ${context.nodeType}`);
  }
  return context.services.conversation;
}

/**
 * Check if node services are initialized
 */
export function useNodeInitialized(): boolean {
  const context = useNodeContext();
  return context.isInitialized;
}

/**
 * Get node initialization error (if any)
 */
export function useNodeError(): Error | null {
  const context = useNodeContext();
  return context.error;
}
