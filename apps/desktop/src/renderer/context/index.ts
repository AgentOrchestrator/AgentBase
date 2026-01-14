/**
 * Context Module
 *
 * Re-exports all context providers and hooks for node services.
 */

// Node services types
export * from './node-services';

// Node context
export {
  NodeContextProvider,
  useNodeContext,
  useNodeServices,
  useTerminalService,
  useWorkspaceService,
  useAgentService,
  useConversationService,
  useNodeInitialized,
  useNodeError,
} from './NodeContext';
export type { NodeContextValue } from './NodeContext';

// Services registry
export {
  NodeServicesRegistryProvider,
  useNodeServicesRegistry,
} from './NodeServicesRegistry';
export type { ServiceFactories, NodeServiceConfig } from './NodeServicesRegistry';
