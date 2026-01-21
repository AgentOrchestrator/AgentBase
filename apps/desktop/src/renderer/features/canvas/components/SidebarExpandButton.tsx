/**
 * Sidebar Expand Button Component
 *
 * Floating button to expand the sidebar when collapsed.
 */

export interface SidebarExpandButtonProps {
  onClick: () => void;
}

export function SidebarExpandButton({ onClick }: SidebarExpandButtonProps) {
  return (
    <button className="sidebar-expand-button" onClick={onClick} aria-label="Expand sidebar">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
