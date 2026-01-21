/**
 * Canvas Context Menu Component
 *
 * Right-click menu for adding nodes to the canvas.
 */
import type { UseCanvasActionsReturn, UseContextMenuReturn } from '../../../hooks';

export interface ContextMenuProps {
  contextMenuState: UseContextMenuReturn;
  canvasActions: UseCanvasActionsReturn;
}

export function ContextMenu({ contextMenuState, canvasActions }: ContextMenuProps) {
  if (!contextMenuState.contextMenu) return null;

  const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;

  return (
    <>
      <div className="context-menu-overlay" onClick={contextMenuState.closeContextMenu} />
      <div
        ref={contextMenuState.contextMenuRef}
        className="context-menu"
        style={{
          position: 'fixed',
          top: contextMenuState.contextMenu.y,
          left: contextMenuState.contextMenu.x,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="context-menu-item" onClick={() => canvasActions.addTerminalNode()}>
          <span className="context-menu-label">Add Terminal</span>
          <span className="context-menu-shortcut">{isMac ? '⌘K' : 'Ctrl+K'}</span>
        </div>
        <div className="context-menu-item" onClick={() => canvasActions.addAgentNode()}>
          <span className="context-menu-label">Add Agent</span>
          <span className="context-menu-shortcut">{isMac ? '⌘T' : 'Ctrl+T'}</span>
        </div>
        <div className="context-menu-divider" />
        <div className="context-menu-item highlight" onClick={() => canvasActions.addStarterNode()}>
          <span className="context-menu-label">New Conversation</span>
          <span className="context-menu-shortcut">{isMac ? '⌘N' : 'Ctrl+N'}</span>
        </div>
      </div>
    </>
  );
}
