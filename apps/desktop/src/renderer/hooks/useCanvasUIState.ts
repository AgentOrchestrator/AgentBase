import { useCallback, useState } from 'react';

/**
 * Return type for the useCanvasUIState hook
 */
export interface UseCanvasUIStateReturn {
  /** ID of the selected Linear issue (for details modal) */
  selectedIssueId: string | null;
  /** Whether the settings modal is open */
  isSettingsOpen: boolean;
  /** Whether the command palette is open */
  isCommandPaletteOpen: boolean;
  /** Whether the new agent modal is open */
  isNewAgentModalOpen: boolean;
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

/**
 * Hook for managing canvas UI state (modals and overlays)
 *
 * Manages:
 * - Linear issue details modal (selectedIssueId)
 * - Settings modal
 * - Command palette
 * - New agent modal
 */
export function useCanvasUIState(): UseCanvasUIStateReturn {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNewAgentModalOpen, setIsNewAgentModalOpen] = useState(false);

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const toggleSettings = useCallback(() => {
    setIsSettingsOpen((prev) => !prev);
  }, []);

  const openCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false);
  }, []);

  const toggleCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen((prev) => !prev);
  }, []);

  const openNewAgentModal = useCallback(() => {
    setIsNewAgentModalOpen(true);
  }, []);

  const closeNewAgentModal = useCallback(() => {
    setIsNewAgentModalOpen(false);
  }, []);

  const toggleNewAgentModal = useCallback(() => {
    setIsNewAgentModalOpen((prev) => !prev);
  }, []);

  return {
    selectedIssueId,
    isSettingsOpen,
    isCommandPaletteOpen,
    isNewAgentModalOpen,
    setSelectedIssueId,
    openSettings,
    closeSettings,
    toggleSettings,
    openCommandPalette,
    closeCommandPalette,
    toggleCommandPalette,
    openNewAgentModal,
    closeNewAgentModal,
    toggleNewAgentModal,
  };
}
