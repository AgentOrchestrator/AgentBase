/**
 * Zustand store for worktree configuration in New Agent Modal.
 *
 * This store manages the state for creating a worktree when starting a new agent,
 * including branch name, folder name, and whether worktree creation is enabled.
 *
 * @see apps/desktop/src/renderer/hooks/__tests__/useWorktreeConfigState.test.ts for acceptance tests
 */

import { create } from 'zustand';

interface WorktreeConfigState {
  enabled: boolean;
  branchName: string;
  folderName: string;
  /** Tracks if user manually edited (to prevent auto-update overwriting) */
  branchManuallyEdited: boolean;
  folderManuallyEdited: boolean;
}

interface WorktreeConfigActions {
  setEnabled: (enabled: boolean) => void;
  setBranchName: (name: string, manual?: boolean) => void;
  setFolderName: (name: string, manual?: boolean) => void;
  /** Update defaults based on description + project name */
  updateDefaults: (description: string, projectName: string) => void;
  /** Reset all state (call when modal closes) */
  reset: () => void;
}

export type WorktreeConfigStore = WorktreeConfigState & WorktreeConfigActions;

/**
 * Sanitizes text for use in branch/folder names.
 * - Converts to lowercase
 * - Replaces non-alphanumeric chars with hyphens
 * - Truncates to 30 characters
 */
const sanitize = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .slice(0, 30)
    .replace(/-+$/g, ''); // Remove trailing hyphens after truncation

const initialState: WorktreeConfigState = {
  enabled: false,
  branchName: '',
  folderName: '',
  branchManuallyEdited: false,
  folderManuallyEdited: false,
};

export const useWorktreeConfigState = create<WorktreeConfigStore>((set, get) => ({
  // State
  ...initialState,

  // Actions
  setEnabled: (enabled) => set({ enabled }),

  setBranchName: (name, manual = true) => set({ branchName: name, branchManuallyEdited: manual }),

  setFolderName: (name, manual = true) => set({ folderName: name, folderManuallyEdited: manual }),

  updateDefaults: (description, projectName) => {
    const state = get();
    const sanitized = sanitize(description);
    const timestamp = Date.now().toString().slice(-6);

    const updates: Partial<WorktreeConfigState> = {};

    if (!state.branchManuallyEdited) {
      updates.branchName = sanitized ? `feature/${sanitized}` : `feature/agent-${timestamp}`;
    }
    if (!state.folderManuallyEdited) {
      updates.folderName = sanitized
        ? `${projectName}-${sanitized}`
        : `${projectName}-agent-${timestamp}`;
    }

    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },

  reset: () => set(initialState),
}));
