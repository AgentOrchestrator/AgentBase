/**
 * Terminal Feature - Public API
 *
 * This module provides all terminal-related functionality including:
 * - Terminal components (TerminalNode, AgentTerminalView)
 * - Terminal service interface and implementation
 * - Terminal types
 */

// Components
export { AgentTerminalView, TerminalNode } from './components';

// Services
export type { INodeService, ITerminalService } from './services';
export { TerminalServiceImpl } from './services';

// Types
export type { TerminalAttachment, TerminalNodeData } from './types';

// Hooks (future)
// export {} from './hooks';
