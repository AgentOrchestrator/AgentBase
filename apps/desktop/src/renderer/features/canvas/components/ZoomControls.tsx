/**
 * Zoom Controls Component
 *
 * Floating action buttons for zooming in and out of the canvas.
 */

export interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ZoomControls({ onZoomIn, onZoomOut }: ZoomControlsProps) {
  return (
    <div className="zoom-controls">
      <button className="zoom-fab" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 5V19M5 12H19"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button className="zoom-fab" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 12H19"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
