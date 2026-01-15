/**
 * Fork Ghost Node
 *
 * Semi-transparent preview node shown during fork drag operation.
 * Follows cursor position and indicates where the forked node will appear.
 */

import React, { useState, useEffect } from 'react';
import { useConnection } from '@xyflow/react';
import { forkStore } from './stores';
import type { ForkDragState } from './stores/IForkStore';
import './ForkGhostNode.css';

/**
 * Ghost node component rendered during fork drag
 */
function ForkGhostNode() {
  const [forkState, setForkState] = useState<ForkDragState>(forkStore.getState());
  const connection = useConnection();

  // Subscribe to fork store state changes
  useEffect(() => {
    const unsubscribe = forkStore.subscribe((state) => {
      setForkState(state);
    });
    return unsubscribe;
  }, []);

  // Don't render if not dragging or no connection in progress
  if (!forkState.isDragging || !connection.inProgress) {
    return null;
  }

  // Get the current drag position from the connection
  const { toX, toY } = connection;

  return (
    <div
      className="fork-ghost-node"
      style={{
        transform: `translate(${toX - 150}px, ${toY - 50}px)`,
      }}
    >
      <div className="fork-ghost-node-header">
        <span className="fork-ghost-node-icon">+</span>
        <span className="fork-ghost-node-title">New Fork</span>
      </div>
      <div className="fork-ghost-node-body">
        <span className="fork-ghost-node-hint">Release to create fork</span>
      </div>
    </div>
  );
}

export default ForkGhostNode;
