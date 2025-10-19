import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider } = body;

    // Validate input
    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    // Validate provider exists for this user
    const { data: existingKey, error: checkError } = await supabase
      .from('llm_api_keys')
      .select('id')
      .eq('account_id', user.id)
      .eq('provider', provider)
      .single();

    if (checkError || !existingKey) {
      return NextResponse.json({ error: 'Provider not found or not configured' }, { status: 404 });
    }

    // First, unset all defaults for this user
    const { error: unsetError } = await supabase
      .from('llm_api_keys')
      .update({ is_default: false })
      .eq('account_id', user.id);

    if (unsetError) {
      console.error('Error unsetting defaults:', unsetError);
      return NextResponse.json({ error: 'Failed to update default provider' }, { status: 500 });
    }

    // Then set the new default
    const { data, error } = await supabase
      .from('llm_api_keys')
      .update({ is_default: true })
      .eq('account_id', user.id)
      .eq('provider', provider)
      .select('id, provider, is_active, is_default, created_at, updated_at')
      .single();

    if (error) {
      console.error('Error setting default:', error);
      return NextResponse.json({ error: 'Failed to set default provider' }, { status: 500 });
    }

    return NextResponse.json({ key: data });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch default provider
    const { data: defaultKey, error } = await supabase
      .from('llm_api_keys')
      .select('id, provider, is_active, is_default, created_at, updated_at')
      .eq('account_id', user.id)
      .eq('is_default', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error fetching default provider:', error);
      return NextResponse.json({ error: 'Failed to fetch default provider' }, { status: 500 });
    }

    return NextResponse.json({ defaultProvider: defaultKey || null });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
