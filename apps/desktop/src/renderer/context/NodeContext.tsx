/**
 * NodeContext
 *
 * React Context for lifecycle-scoped node services.
 * Each node wraps its content with NodeContextProvider to get
 * type-appropriate services that are disposed on unmount.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import type { AgentType } from '../../../types/coding-agent-status';
import type {
  NodeType,
  ITerminalService,
  IWorkspaceService,
  IAgentService,
  NodeServices,
} from './node-services';
import {
  hasTerminalService,
  hasWorkspaceService,
  hasAgentService,
} from './node-services';
import { useNodeServicesRegistry } from './NodeServicesRegistry';

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

/**
 * Configuration for node services
 */
export interface NodeServiceConfig {
  /** Terminal ID (for terminal/agent nodes) */
  terminalId?: string;
  /** Agent ID (for agent nodes) */
  agentId?: string;
  /** Agent type (for agent nodes) */
  agentType?: AgentType;
  /** Workspace path (for all nodes with workspace support) */
  workspacePath?: string;
  /** Auto-start CLI on mount (for agent nodes) */
  autoStartCli?: boolean;
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
  agentType?: AgentType;
  /** Workspace path */
  workspacePath?: string;
  /** Auto-start CLI on mount (agent nodes only) */
  autoStartCli?: boolean;
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
  workspacePath,
  autoStartCli = false,
  children,
}: NodeContextProviderProps) {
  const registry = useNodeServicesRegistry();
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const servicesRef = useRef<NodeServices | null>(null);
  const isDisposingRef = useRef(false);

  // Build service config
  const config: NodeServiceConfig = {
    terminalId: terminalId || `terminal-${nodeId}`,
    agentId: agentId || `agent-${nodeId}`,
    agentType: agentType || 'claude_code',
    workspacePath,
    autoStartCli,
  };

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
  }, [nodeId, nodeType, registry]);

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

  return (
    <NodeContext.Provider value={contextValue}>{children}</NodeContext.Provider>
  );
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
    throw new Error(
      `Terminal service not available for node type: ${context.nodeType}`
    );
  }
  return context.services.terminal;
}

/**
 * Access workspace service (throws if not available)
 */
export function useWorkspaceService(): IWorkspaceService {
  const context = useNodeContext();
  if (!hasWorkspaceService(context.services)) {
    throw new Error(
      `Workspace service not available for node type: ${context.nodeType}`
    );
  }
  return context.services.workspace;
}

/**
 * Access agent service (throws if not available)
 */
export function useAgentService(): IAgentService {
  const context = useNodeContext();
  if (!hasAgentService(context.services)) {
    throw new Error(
      `Agent service not available for node type: ${context.nodeType}`
    );
  }
  return context.services.agent;
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
