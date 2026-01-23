/**
 * Utility functions for processing ReactFlow node changes.
 *
 * These utilities are extracted from Canvas.tsx to enable direct unit testing
 * of the change detection logic.
 */

/**
 * ReactFlow NodeChange type subset for change detection.
 * We only need the type field to determine what kind of change occurred.
 */
export interface NodeChangeForDetection {
  type: string;
  id?: string;
  position?: { x: number; y: number };
}

/**
 * Checks if any of the changes are of type 'remove'.
 *
 * This is used to determine if nodes were deleted via keyboard (Delete/Backspace),
 * which requires triggering canvas persistence.
 *
 * @param changes - Array of ReactFlow node changes
 * @returns true if any change is a removal
 */
export function hasRemoveChanges(changes: NodeChangeForDetection[]): boolean {
  return changes.some((change) => change.type === 'remove');
}

/**
 * Checks if any of the changes are of type 'position'.
 *
 * Position changes are handled separately (via debounced effects) and don't
 * need immediate persistence in handleNodesChange.
 *
 * @param changes - Array of ReactFlow node changes
 * @returns true if any change is a position update
 */
export function hasPositionChanges(changes: NodeChangeForDetection[]): boolean {
  return changes.some((change) => change.type === 'position');
}
