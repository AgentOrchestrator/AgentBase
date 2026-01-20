/**
 * Fork Error Toast Component
 *
 * Displays fork validation errors when they occur outside the modal.
 */

export interface ForkErrorToastProps {
  error: string | null;
  isModalOpen: boolean;
  onDismiss: () => void;
}

export function ForkErrorToast({ error, isModalOpen, onDismiss }: ForkErrorToastProps) {
  // Only show when there's an error and the modal is not open
  if (!error || isModalOpen) return null;

  return (
    <div className="fork-error-toast">
      <span className="fork-error-icon">!</span>
      <span className="fork-error-message">{error}</span>
      <button className="fork-error-dismiss" onClick={onDismiss} aria-label="Dismiss">
        &times;
      </button>
    </div>
  );
}
