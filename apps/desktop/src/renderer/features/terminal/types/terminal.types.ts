/**
 * Terminal Feature Types
 *
 * Type definitions for the Terminal feature.
 */

import type { TerminalAttachment } from '../../../types/attachments';

/**
 * Data structure for a Terminal node in the canvas.
 */
export interface TerminalNodeData {
  terminalId: string;
  attachments?: TerminalAttachment[];
  autoStartClaude?: boolean;
  // Legacy support - will be migrated to attachments array
  issue?: {
    id?: string;
    identifier: string;
    title: string;
    url: string;
  };
}

// Re-export attachment types for convenience
export type { TerminalAttachment } from '../../../types/attachments';
