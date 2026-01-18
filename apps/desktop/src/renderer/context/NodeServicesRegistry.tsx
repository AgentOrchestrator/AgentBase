/**
 * NodeServicesRegistry
 *
 * App-level provider that manages service factories and lifecycle.
 * Caches services per node and handles disposal.
 */

import type React from 'react';
import { createContext, useCallback, useContext, useRef } from 'react';
import type { AgentType } from '../../../types/coding-agent-status';
import type {
  AgentNodeServices,
  ConversationNodeServices,
  CustomNodeServices,
  IAgentService,
  IConversationService,
  ITerminalService,
  IWorkspaceService,
  NodeServices,
  NodeType,
  TerminalNodeServices,
} from './node-services';

// =============================================================================
// Factory Types
// =============================================================================

/**
 * Factory functions for creating services
 */
export interface ServiceFactories {
  /** Create a terminal service */
  createTerminalService: (nodeId: string, terminalId: string) => ITerminalService;
  /** Create a workspace service */
  createWorkspaceService: (nodeId: string, workspacePath?: string) => IWorkspaceService;
  /** Create an agent service (creates adapter internally based on agentType) */
  createAgentService: (
    nodeId: string,
    agentId: string,
    agentType: AgentType,
    terminalService: ITerminalService
  ) => IAgentService;
  /** Create a conversation service */
  createConversationService: (
    nodeId: string,
    sessionId: string,
    agentType: string
  ) => IConversationService;
}

/**
 * Configuration passed when creating services
 */
export interface NodeServiceConfig {
  terminalId?: string;
  agentId?: string;
  agentType?: AgentType;
  workspacePath?: string;
  /** Session ID for conversation nodes */
  sessionId?: string;
}

// =============================================================================
// Registry Context
// =============================================================================

interface NodeServicesRegistryValue {
  /** Service factory functions */
  factories: ServiceFactories;
  /** Get or create services for a node */
  getOrCreateServices: (
    nodeId: string,
    nodeType: NodeType,
    config: NodeServiceConfig
  ) => NodeServices;
  /** Dispose services for a node */
  disposeServices: (nodeId: string) => Promise<void>;
  /** Check if services exist for a node */
  hasServices: (nodeId: string) => boolean;
}

const NodeServicesRegistryContext = createContext<NodeServicesRegistryValue | null>(null);

// =============================================================================
// Provider Props
// =============================================================================

export interface NodeServicesRegistryProviderProps {
  /** Service factory functions */
  factories: ServiceFactories;
  /** Child components */
  children: React.ReactNode;
}

// =============================================================================
// Provider Component
// =============================================================================

/**
 * NodeServicesRegistryProvider
 *
 * App-level provider that holds service factories and caches created services.
 * Wrap your app with this provider to enable NodeContext in nodes.
 */
export function NodeServicesRegistryProvider({
  factories,
  children,
}: NodeServicesRegistryProviderProps) {
  // Cache of active services by nodeId
  const servicesCache = useRef<Map<string, NodeServices>>(new Map());

  /**
   * Get or create services for a node
   */
  const getOrCreateServices = useCallback(
    (nodeId: string, nodeType: NodeType, config: NodeServiceConfig): NodeServices => {
      // Return cached if exists
      const cached = servicesCache.current.get(nodeId);
      if (cached) {
        console.log('[NodeServicesRegistry] Returning CACHED services', { nodeId, nodeType });
        return cached;
      }

      console.log('[NodeServicesRegistry] Creating NEW services', { nodeId, nodeType, config });

      // Create new services based on node type
      let services: NodeServices;

      switch (nodeType) {
        case 'terminal': {
          const terminalId = config.terminalId || `terminal-${nodeId}`;
          const terminal = factories.createTerminalService(nodeId, terminalId);
          const workspace = factories.createWorkspaceService(nodeId, config.workspacePath);

          services = {
            type: 'terminal',
            terminal,
            workspace,
          } as TerminalNodeServices;
          break;
        }

        case 'agent': {
          const terminalId = config.terminalId || `terminal-${nodeId}`;
          const agentId = config.agentId || `agent-${nodeId}`;
          const agentType = config.agentType || 'claude_code';

          const terminal = factories.createTerminalService(nodeId, terminalId);
          const workspace = factories.createWorkspaceService(nodeId, config.workspacePath);
          const agent = factories.createAgentService(nodeId, agentId, agentType, terminal);

          services = {
            type: 'agent',
            agent,
            terminal,
            workspace,
          } as AgentNodeServices;
          break;
        }

        case 'conversation': {
          const sessionId = config.sessionId || '';
          const agentType = config.agentType || 'claude_code';

          const conversation = factories.createConversationService(nodeId, sessionId, agentType);

          services = {
            type: 'conversation',
            conversation,
          } as ConversationNodeServices;
          break;
        }
        default: {
          services = { type: 'custom' } as CustomNodeServices;
          break;
        }
      }

      // Cache and return
      servicesCache.current.set(nodeId, services);
      return services;
    },
    [factories]
  );

  /**
   * Dispose services for a node
   */
  const disposeServices = useCallback(async (nodeId: string): Promise<void> => {
    console.log('[NodeServicesRegistry] disposeServices called', { nodeId });
    const services = servicesCache.current.get(nodeId);
    if (!services) {
      console.log('[NodeServicesRegistry] No services to dispose', { nodeId });
      return;
    }

    // IMPORTANT: Remove from cache FIRST to prevent race conditions
    // This ensures that if getOrCreateServices is called during dispose,
    // it will create new services instead of returning the ones being disposed
    servicesCache.current.delete(nodeId);
    console.log('[NodeServicesRegistry] Removed from cache, now disposing', { nodeId });

    // Dispose all services in the bundle
    const disposePromises: Promise<void>[] = [];

    if ('terminal' in services && services.terminal) {
      disposePromises.push(services.terminal.dispose());
    }
    if ('workspace' in services && services.workspace) {
      disposePromises.push(services.workspace.dispose());
    }
    if ('agent' in services && services.agent) {
      disposePromises.push(services.agent.dispose());
    }
    if ('conversation' in services && services.conversation) {
      disposePromises.push(services.conversation.dispose());
    }

    await Promise.all(disposePromises);
    console.log('[NodeServicesRegistry] Dispose complete', { nodeId });
  }, []);

  /**
   * Check if services exist for a node
   */
  const hasServices = useCallback((nodeId: string): boolean => {
    return servicesCache.current.has(nodeId);
  }, []);

  const value: NodeServicesRegistryValue = {
    factories,
    getOrCreateServices,
    disposeServices,
    hasServices,
  };

  return (
    <NodeServicesRegistryContext.Provider value={value}>
      {children}
    </NodeServicesRegistryContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Access the node services registry
 */
export function useNodeServicesRegistry(): NodeServicesRegistryValue {
  const context = useContext(NodeServicesRegistryContext);
  if (!context) {
    throw new Error('useNodeServicesRegistry must be used within NodeServicesRegistryProvider');
  }
  return context;
}
