import { create } from 'zustand';

/**
 * Canvas UI State Store
 *
 * Manages canvas UI state (modals and overlays):
 * - Linear issue details modal (selectedIssueId)
 * - Settings modal
 * - Command palette
 * - New agent modal
 */

// =============================================================================
// Types
// =============================================================================

interface CanvasUIState {
  /** ID of the selected Linear issue (for details modal) */
  selectedIssueId: string | null;
  /** Whether the settings modal is open */
  isSettingsOpen: boolean;
  /** Whether the command palette is open */
  isCommandPaletteOpen: boolean;
  /** Whether the new agent modal is open */
  isNewAgentModalOpen: boolean;
}

interface CanvasUIActions {
  /** Set the selected issue ID */
  setSelectedIssueId: (id: string | null) => void;
  /** Open settings modal */
  openSettings: () => void;
  /** Close settings modal */
  closeSettings: () => void;
  /** Toggle settings modal */
  toggleSettings: () => void;
  /** Open command palette */
  openCommandPalette: () => void;
  /** Close command palette */
  closeCommandPalette: () => void;
  /** Toggle command palette */
  toggleCommandPalette: () => void;
  /** Open new agent modal */
  openNewAgentModal: () => void;
  /** Close new agent modal */
  closeNewAgentModal: () => void;
  /** Toggle new agent modal */
  toggleNewAgentModal: () => void;
}

export type CanvasUIStore = CanvasUIState & CanvasUIActions;

/**
 * Return type for the useCanvasUIState hook (backwards compatibility)
 */
export type UseCanvasUIStateReturn = CanvasUIStore;

// =============================================================================
// Store
// =============================================================================

export const useCanvasUIState = create<CanvasUIStore>((set) => ({
  // Initial state
  selectedIssueId: null,
  isSettingsOpen: false,
  isCommandPaletteOpen: false,
  isNewAgentModalOpen: false,

  // Actions
  setSelectedIssueId: (id) => set({ selectedIssueId: id }),

  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
  toggleCommandPalette: () =>
    set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),

  openNewAgentModal: () => set({ isNewAgentModalOpen: true }),
  closeNewAgentModal: () => set({ isNewAgentModalOpen: false }),
  toggleNewAgentModal: () => set((state) => ({ isNewAgentModalOpen: !state.isNewAgentModalOpen })),
}));
