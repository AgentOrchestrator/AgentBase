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

    // Fetch user's LLM API keys (without exposing the actual keys)
    const { data: keys, error } = await supabase
      .from('llm_api_keys')
      .select('id, provider, is_active, is_default, created_at, updated_at')
      .eq('account_id', user.id)
      .order('provider', { ascending: true });

    if (error) {
      console.error('Error fetching LLM keys:', error);
      return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
    }

    return NextResponse.json({ keys: keys || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, api_key } = body;

    // Validate input
    if (!provider || !api_key) {
      return NextResponse.json({ error: 'Provider and API key are required' }, { status: 400 });
    }

    // Validate provider
    const validProviders = ['openai', 'anthropic', 'google', 'groq', 'ollama', 'openrouter'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // Insert or update API key (upsert)
    const { data, error } = await supabase
      .from('llm_api_keys')
      .upsert({
        account_id: user.id,
        provider,
        api_key,
        is_active: true,
      }, {
        onConflict: 'account_id,provider'
      })
      .select('id, provider, is_active, is_default, created_at, updated_at')
      .single();

    if (error) {
      console.error('Error saving LLM key:', error);
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
    }

    return NextResponse.json({ key: data });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    // Delete the API key
    const { error } = await supabase
      .from('llm_api_keys')
      .delete()
      .eq('account_id', user.id)
      .eq('provider', provider);

    if (error) {
      console.error('Error deleting LLM key:', error);
      return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
