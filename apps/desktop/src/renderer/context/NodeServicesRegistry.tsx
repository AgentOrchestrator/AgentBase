/**
 * NodeServicesRegistry
 *
 * App-level provider that manages service factories and lifecycle.
 * Caches services per node and handles disposal.
 */

import React, { createContext, useContext, useRef, useCallback } from 'react';
import type { AgentType } from '../../../types/coding-agent-status';
import type {
  NodeType,
  ITerminalService,
  IWorkspaceService,
  IAgentService,
  NodeServices,
  TerminalNodeServices,
  AgentNodeServices,
  WorkspaceNodeServices,
  CustomNodeServices,
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
  /** Create an agent service */
  createAgentService: (
    nodeId: string,
    agentId: string,
    agentType: AgentType,
    terminalService: ITerminalService
  ) => IAgentService;
}

/**
 * Configuration passed when creating services
 */
export interface NodeServiceConfig {
  terminalId?: string;
  agentId?: string;
  agentType?: AgentType;
  workspacePath?: string;
  autoStartCli?: boolean;
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
        return cached;
      }

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

          // Configure auto-start if specified
          if (config.autoStartCli !== undefined) {
            agent.setAutoStart(config.autoStartCli);
          }

          services = {
            type: 'agent',
            agent,
            terminal,
            workspace,
          } as AgentNodeServices;
          break;
        }

        case 'workspace': {
          const workspace = factories.createWorkspaceService(nodeId, config.workspacePath);

          services = {
            type: 'workspace',
            workspace,
          } as WorkspaceNodeServices;
          break;
        }

        case 'custom':
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
    const services = servicesCache.current.get(nodeId);
    if (!services) return;

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

    await Promise.all(disposePromises);
    servicesCache.current.delete(nodeId);
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
    throw new Error(
      'useNodeServicesRegistry must be used within NodeServicesRegistryProvider'
    );
  }
  return context;
}
