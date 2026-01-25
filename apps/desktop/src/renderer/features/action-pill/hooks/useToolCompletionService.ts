/**
 * Hook to initialize ToolCompletionService
 *
 * Initializes the service on mount and cleans up on unmount.
 * Use this in ActionPill or a parent component.
 */

import { useEffect } from 'react';
import { toolCompletionService } from '../services';

export function useToolCompletionService(): void {
  useEffect(() => {
    toolCompletionService.initialize();

    return () => {
      toolCompletionService.dispose();
    };
  }, []);
}
