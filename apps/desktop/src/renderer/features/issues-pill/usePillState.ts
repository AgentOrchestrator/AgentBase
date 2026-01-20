import { useCallback, useState } from 'react';

/**
 * Return type for the usePillState hook
 */
export interface UsePillStateReturn {
  /** Whether the pill is expanded */
  isPillExpanded: boolean;
  /** Whether the pill is in square shape (intermediate animation state) */
  isPillSquare: boolean;
  /** Whether to show the pill content container */
  showPillContent: boolean;
  /** Whether the content inside is visible (for fade animation) */
  isContentVisible: boolean;
  /** Whether the collapsed text is visible */
  isTextVisible: boolean;
  /** Toggle the pill between expanded and collapsed states */
  togglePill: () => void;
  /** Collapse the pill (one-way collapse) */
  collapsePill: () => void;
}

/**
 * Hook for managing the issues pill animation state
 *
 * Animation sequence for expansion:
 * 1. Set isPillExpanded true, isPillSquare true (simultaneously)
 * 2. After 350ms, set showPillContent true
 * 3. After 450ms (350 + 100), set isContentVisible true
 *
 * Animation sequence for collapse:
 * 1. Set isContentVisible false, showPillContent false (immediately)
 * 2. After 50ms, set isPillSquare false, isPillExpanded false
 * 3. After 400ms (50 + 350), set isTextVisible true
 *
 * @param onExpand - Optional callback to run when pill is expanded (e.g., fetch data)
 */
export function usePillState(onExpand?: () => void): UsePillStateReturn {
  const [isPillExpanded, setIsPillExpanded] = useState(false);
  const [isPillSquare, setIsPillSquare] = useState(false);
  const [showPillContent, setShowPillContent] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [isTextVisible, setIsTextVisible] = useState(true);

  const togglePill = useCallback(() => {
    if (!isPillExpanded) {
      // Call onExpand callback when expanding (e.g., to fetch issues)
      onExpand?.();

      // Hide text immediately when expanding
      setIsTextVisible(false);
      // Both phases start simultaneously
      setIsPillExpanded(true);
      setIsPillSquare(true);
      // Show pill content after expansion completes (300ms) + 50ms delay
      setTimeout(() => {
        setShowPillContent(true);
        // Start content animation after pill content is shown
        setTimeout(() => {
          setIsContentVisible(true);
        }, 100);
      }, 350);
    } else {
      // Hide animations immediately when collapsing
      setIsContentVisible(false);
      // Hide pill content immediately when collapsing
      setShowPillContent(false);
      // Both phases collapse simultaneously
      setIsPillSquare(false);
      setIsPillExpanded(false);
      // Start text fade-in animation after collapse completes (300ms + 50ms delay)
      setTimeout(() => {
        setIsTextVisible(true);
      }, 350);
    }
  }, [isPillExpanded, onExpand]);

  const collapsePill = useCallback(() => {
    // First hide animations immediately
    setIsContentVisible(false);
    // First hide content with 50ms delay
    setShowPillContent(false);
    setTimeout(() => {
      // Then collapse the pill
      setIsPillSquare(false);
      setIsPillExpanded(false);
      // Start text fade-in animation after collapse completes (300ms + 50ms delay)
      setTimeout(() => {
        setIsTextVisible(true);
      }, 350);
    }, 50);
  }, []);

  return {
    isPillExpanded,
    isPillSquare,
    showPillContent,
    isContentVisible,
    isTextVisible,
    togglePill,
    collapsePill,
  };
}
