/**
 * Supabase implementation of ICanvasLayoutRepository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types.js';
import type { CanvasNodePosition, ICanvasLayoutRepository } from '../../interfaces/repositories.js';

export class SupabaseCanvasLayoutRepository implements ICanvasLayoutRepository {
  constructor(
    private client: SupabaseClient<Database>,
    _userId: string
  ) {}

  async getNodePositions(userId: string): Promise<CanvasNodePosition[]> {
    const { data, error } = await this.client
      .from('user_canvas_layouts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[CanvasLayoutRepository] Error getting node positions:', error.message);
      return [];
    }

    return (data || []).map((row) => this.mapToCanvasNodePosition(row));
  }

  async saveNodePosition(
    userId: string,
    nodeId: string,
    positionX: number,
    positionY: number
  ): Promise<CanvasNodePosition | null> {
    try {
      const now = new Date().toISOString();

      const { data, error } = await this.client
        .from('user_canvas_layouts')
        .upsert(
          {
            user_id: userId,
            node_id: nodeId,
            position_x: positionX,
            position_y: positionY,
            updated_at: now,
          },
          {
            onConflict: 'user_id,node_id',
            ignoreDuplicates: false,
          }
        )
        .select()
        .single();

      if (error) {
        console.error('[CanvasLayoutRepository] Error saving node position:', error.message);
        return null;
      }

      if (!data) {
        return null;
      }

      return this.mapToCanvasNodePosition(data);
    } catch (error) {
      console.error('[CanvasLayoutRepository] Unexpected error saving position:', error);
      return null;
    }
  }

  async saveNodePositions(
    userId: string,
    positions: Array<{ nodeId: string; positionX: number; positionY: number }>
  ): Promise<boolean> {
    try {
      const now = new Date().toISOString();

      const records = positions.map((pos) => ({
        user_id: userId,
        node_id: pos.nodeId,
        position_x: pos.positionX,
        position_y: pos.positionY,
        updated_at: now,
      }));

      const { error } = await this.client.from('user_canvas_layouts').upsert(records, {
        onConflict: 'user_id,node_id',
        ignoreDuplicates: false,
      });

      if (error) {
        console.error('[CanvasLayoutRepository] Error batch saving positions:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[CanvasLayoutRepository] Unexpected error batch saving:', error);
      return false;
    }
  }

  async deleteNodePosition(userId: string, nodeId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('user_canvas_layouts')
        .delete()
        .eq('user_id', userId)
        .eq('node_id', nodeId);

      if (error) {
        console.error('[CanvasLayoutRepository] Error deleting node position:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[CanvasLayoutRepository] Unexpected error deleting position:', error);
      return false;
    }
  }

  async clearAllPositions(userId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('user_canvas_layouts')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('[CanvasLayoutRepository] Error clearing all positions:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[CanvasLayoutRepository] Unexpected error clearing positions:', error);
      return false;
    }
  }

  private mapToCanvasNodePosition(
    data: Database['public']['Tables']['user_canvas_layouts']['Row']
  ): CanvasNodePosition {
    return {
      id: data.id,
      userId: data.user_id,
      nodeId: data.node_id,
      positionX: data.position_x,
      positionY: data.position_y,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
