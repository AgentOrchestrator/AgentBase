/**
 * Sidebar Header Component
 *
 * Displays the user info and collapse toggle button.
 */

export interface SidebarHeaderProps {
  username: string | null;
  error: string | null;
  onToggle: () => void;
}

export function SidebarHeader({ username, error, onToggle }: SidebarHeaderProps) {
  return (
    <div className="sidebar-header">
      <div style={{ flex: 1, minWidth: 0 }}>
        {username ? (
          <>
            <h2 className="sidebar-title">{username.replace(/^@/, '')}'s</h2>
            <div className="sidebar-username">Agent Base</div>
          </>
        ) : (
          <h2 className="sidebar-title">Canvas</h2>
        )}
        {error && (
          <div className="sidebar-error" title={error}>
            Error: {error}
          </div>
        )}
      </div>
      <button className="sidebar-toggle" onClick={onToggle} aria-label="Collapse sidebar">
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
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    </div>
  );
}
