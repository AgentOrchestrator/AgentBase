import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST() {
  console.log('🔍 Unlink GitHub triggered');

  // Create a Supabase client with cookie support for server-side
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.log('❌ Not authenticated');
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Get all user identities
  const { data: identities, error: identitiesError } = await supabase.auth.getUserIdentities();

  if (identitiesError) {
    console.log('❌ Error fetching identities:', identitiesError);
    return NextResponse.json({ error: identitiesError.message }, { status: 400 });
  }

  // Find the GitHub identity
  const githubIdentity = identities?.identities.find(
    (identity) => identity.provider === 'github'
  );

  if (!githubIdentity) {
    console.log('❌ No GitHub identity found');
    return NextResponse.json({ error: 'No GitHub identity found to unlink' }, { status: 400 });
  }

  // Unlink the GitHub identity
  console.log('🔓 Attempting to unlink GitHub identity:', githubIdentity.id);
  const { error: unlinkError } = await supabase.auth.unlinkIdentity(githubIdentity);

  if (unlinkError) {
    console.log('❌ Error unlinking identity:', unlinkError);
    return NextResponse.json({ error: unlinkError.message }, { status: 400 });
  }

  console.log('✅ GitHub identity unlinked successfully');

  // Clean up GitHub metadata in public.users
  // (auth.users metadata is automatically cleaned by Supabase Auth)
  try {
    const { error: updateError } = await supabase
      .from('users')
      .update({
        github_username: null,
        github_avatar_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.log('⚠️ Warning: GitHub unlinked but public.users cleanup failed:', updateError);
      return NextResponse.json({
        success: true,
        warning: 'GitHub unlinked but metadata cleanup had issues'
      });
    }

    console.log('✅ GitHub unlinked and metadata cleaned successfully');
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Error cleaning metadata:', error);
    return NextResponse.json({
      success: true,
      warning: 'GitHub unlinked but metadata cleanup failed'
    });
  }
}
