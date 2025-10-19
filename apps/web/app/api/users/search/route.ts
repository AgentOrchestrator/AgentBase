import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    // Query public.users table with search
    let usersQuery = supabase
      .from('users')
      .select('id, email, display_name, avatar_url, github_username, github_avatar_url')
      .limit(100); // Limit to 100 users for performance

    // Apply search filter if query provided
    if (query) {
      const searchLower = `%${query.toLowerCase()}%`;
      usersQuery = usersQuery.or(
        `email.ilike.${searchLower},display_name.ilike.${searchLower},github_username.ilike.${searchLower}`
      );
    }

    const { data: users, error } = await usersQuery;

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // Map to expected format and limit to 10 for autocomplete
    const filteredUsers = (users || [])
      .slice(0, 10)
      .map((user) => ({
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        x_github_name: user.github_username,
        x_github_avatar_url: user.github_avatar_url,
      }));

    return NextResponse.json({ users: filteredUsers });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
