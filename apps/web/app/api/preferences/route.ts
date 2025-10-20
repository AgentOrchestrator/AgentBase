import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user preferences, create with defaults if not exists
    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      // If preferences don't exist, create them with defaults
      if (error.code === 'PGRST116') {
        const { data: newPreferences, error: insertError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: user.id,
            ai_summary_enabled: true,
            ai_title_enabled: true,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating preferences:', insertError);
          return NextResponse.json({ error: 'Failed to create preferences' }, { status: 500 });
        }

        return NextResponse.json({ preferences: newPreferences });
      }

      console.error('Error fetching preferences:', error);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ai_summary_enabled, ai_title_enabled, ai_model_provider, ai_model_name } = body;

    // Build update object with only provided fields
    const updateData: any = { user_id: user.id };

    if (typeof ai_summary_enabled === 'boolean') {
      updateData.ai_summary_enabled = ai_summary_enabled;
    }

    if (typeof ai_title_enabled === 'boolean') {
      updateData.ai_title_enabled = ai_title_enabled;
    }

    if (typeof ai_model_provider === 'string') {
      updateData.ai_model_provider = ai_model_provider;
    }

    if (typeof ai_model_name === 'string') {
      updateData.ai_model_name = ai_model_name;
    }

    // Validate at least one field is provided
    if (Object.keys(updateData).length === 1) { // Only user_id
      return NextResponse.json({ error: 'At least one preference field must be provided' }, { status: 400 });
    }

    // Upsert user preferences
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(updateData, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating preferences:', error);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({ preferences: data });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
