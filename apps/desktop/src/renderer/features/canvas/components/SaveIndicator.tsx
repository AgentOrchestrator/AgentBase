/**
 * Save Indicator Component
 *
 * Displays the current save status of the canvas.
 */

export interface SaveIndicatorProps {
  isSaving: boolean;
  lastSavedAt: Date | null;
}

export function SaveIndicator({ isSaving, lastSavedAt }: SaveIndicatorProps) {
  return (
    <div className={`save-indicator ${isSaving ? 'saving' : ''}`}>
      {isSaving ? 'Saving...' : lastSavedAt ? 'Saved' : ''}
    </div>
  );
}
