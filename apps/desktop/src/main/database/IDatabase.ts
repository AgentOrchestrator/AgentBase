/**
 * Database interface for canvas state persistence
 * Defines the contract that all database implementations must follow
 */

import { CanvasState, CanvasMetadata } from '../types/database';

export interface IDatabase {
  /**
   * Initialize the database (create tables, run migrations, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Save a complete canvas state to the database
   * @param canvasId - Unique identifier for the canvas
   * @param state - The complete canvas state to save
   */
  saveCanvas(canvasId: string, state: CanvasState): Promise<void>;

  /**
   * Load a canvas state from the database
   * @param canvasId - Unique identifier for the canvas
   * @returns The canvas state, or null if not found
   */
  loadCanvas(canvasId: string): Promise<CanvasState | null>;

  /**
   * List all saved canvases with metadata
   * @returns Array of canvas metadata
   */
  listCanvases(): Promise<CanvasMetadata[]>;

  /**
   * Delete a canvas and all its associated data
   * @param canvasId - Unique identifier for the canvas to delete
   */
  deleteCanvas(canvasId: string): Promise<void>;

  /**
   * Get the current canvas ID (the last opened or created canvas)
   * @returns The current canvas ID, or null if none exists
   */
  getCurrentCanvasId(): Promise<string | null>;

  /**
   * Set the current canvas ID
   * @param canvasId - The canvas ID to set as current
   */
  setCurrentCanvasId(canvasId: string): Promise<void>;

  /**
   * Close the database connection
   */
  close(): void;
}
