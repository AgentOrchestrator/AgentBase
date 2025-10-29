import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // For cookie storage: use NEXT_PUBLIC_SUPABASE_URL (must match client-side)
  // For API calls: use SUPABASE_SERVER_URL if available (for Docker networking)
  const cookieUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const apiUrl = process.env.SUPABASE_SERVER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;

  console.log('[Middleware] Cookie URL:', cookieUrl, 'API URL:', apiUrl);

  const supabase = createServerClient(
    cookieUrl, // This determines cookie names (must match client)
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
      global: {
        // Override fetch to use SUPABASE_SERVER_URL for actual API calls
        fetch: (url, options) => {
          // Convert Request object to string URL if needed
          const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
          const urlObj = new URL(urlString);

          // Replace the URL origin with the server URL for API calls
          if (apiUrl !== cookieUrl) {
            const apiUrlObj = new URL(apiUrl);
            urlObj.protocol = apiUrlObj.protocol;
            urlObj.host = apiUrlObj.host;
            urlObj.port = apiUrlObj.port;
          }
          return fetch(urlObj.toString(), options);
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  const { data: { user }, error } = await supabase.auth.getUser();
  console.log('[Middleware] getUser - user:', user?.id, 'error:', error?.message);

  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                     request.nextUrl.pathname.startsWith('/register') ||
                     request.nextUrl.pathname.startsWith('/auth/callback');

  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  // Skip authentication check for API routes (they handle auth themselves)
  if (isApiRoute) {
    return response;
  }

  // If user is not logged in and trying to access protected page, redirect to login
  if (!user && !isAuthPage) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If user is logged in and trying to access auth pages, redirect to home
  if (user && isAuthPage && !request.nextUrl.pathname.startsWith('/auth/callback')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
