import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  console.log('🔍 Auth callback triggered:', request.url);

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  console.log('📝 Code:', code ? 'present' : 'missing');
  console.log('📝 Next:', next);

  if (!code) {
    console.log('❌ No code provided');
    const redirectPath = next.includes('settings') ? '/settings' : '/login';
    return NextResponse.redirect(`${origin}${redirectPath}?error=no_code`);
  }

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

  // Exchange the code for a session
  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  console.log('📦 Session data:', sessionData ? 'received' : 'null');
  console.log('❌ Exchange error:', exchangeError);

  if (exchangeError) {
    console.log('⚠️ Code exchange failed:', exchangeError.message);
    const redirectPath = next.includes('settings') ? '/settings' : '/login';
    return NextResponse.redirect(`${origin}${redirectPath}?error=link_failed&message=${encodeURIComponent(exchangeError.message)}`);
  }

  if (!sessionData?.session) {
    console.log('⚠️ No session returned');
    const redirectPath = next.includes('settings') ? '/settings' : '/login';
    return NextResponse.redirect(`${origin}${redirectPath}?error=no_session`);
  }

  console.log('✅ GitHub linked successfully!');
  console.log('👤 User:', sessionData.user?.email);
  console.log('🔗 Providers:', sessionData.user?.app_metadata?.providers);

  // No need to manually update metadata - Supabase Auth automatically updates
  // auth.users.raw_user_meta_data when a provider is linked, and our database
  // trigger syncs it to public.users automatically.

  // Success! Redirect back to the page they came from
  const redirectPath = next.includes('settings') ? '/settings' : next;
  return NextResponse.redirect(`${origin}${redirectPath}?success=github_linked`);
}
