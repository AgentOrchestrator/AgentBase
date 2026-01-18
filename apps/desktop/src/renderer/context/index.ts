/**
 * Context Module
 *
 * Re-exports all context providers and hooks for node services.
 */

export type { NodeContextValue } from './NodeContext';

// Node context
export {
  NodeContextProvider,
  useAgentService,
  useConversationService,
  useNodeContext,
  useNodeError,
  useNodeInitialized,
  useNodeServices,
  useTerminalService,
  useWorkspaceService,
} from './NodeContext';
export type { NodeServiceConfig, ServiceFactories } from './NodeServicesRegistry';

// Services registry
export {
  NodeServicesRegistryProvider,
  useNodeServicesRegistry,
} from './NodeServicesRegistry';
// Node services types
export * from './node-services';

// Theme context
export { ThemeProvider, useTheme } from './ThemeContext';
