import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's canvas layouts
    const { data: layouts, error } = await supabase
      .from('user_canvas_layouts')
      .select('node_id, position_x, position_y')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching canvas layouts:', error);
      return NextResponse.json({ error: 'Failed to fetch layouts' }, { status: 500 });
    }

    // Convert to a more convenient format
    const layoutMap = layouts.reduce((acc, layout) => {
      acc[layout.node_id] = {
        x: layout.position_x,
        y: layout.position_y
      };
      return acc;
    }, {} as Record<string, { x: number; y: number }>);

    return NextResponse.json({ layout: layoutMap });
  } catch (error) {
    console.error('Error in GET /api/canvas/layout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { nodes } = body;

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json({ error: 'Invalid nodes data' }, { status: 400 });
    }

    // Prepare layout data for upsert
    const layoutData = nodes.map((node: any) => ({
      user_id: user.id,
      node_id: node.id,
      position_x: node.position.x,
      position_y: node.position.y,
    }));

    // Upsert the layouts (insert or update)
    const { error } = await supabase
      .from('user_canvas_layouts')
      .upsert(layoutData, {
        onConflict: 'user_id,node_id'
      });

    if (error) {
      console.error('Error saving canvas layouts:', error);
      return NextResponse.json({ error: 'Failed to save layouts' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/canvas/layout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
