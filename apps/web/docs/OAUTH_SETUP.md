# OAuth Setup Guide

## Supabase Configuration

### Important: No Dashboard Changes Needed!

**You do NOT need to change the callback URL in the Supabase dashboard.**

Supabase handles OAuth callbacks at their own endpoint (`https://[project-ref].supabase.co/auth/v1/callback`), exchanges the code for a session, and then redirects to your `redirectTo` URL.

The `redirectTo` URL is specified in your **code**, not in the dashboard:

```typescript
// lib/auth.ts
supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: `${window.location.origin}/api/auth/callback`, // ← This is your app's endpoint
  },
});
```

### What You DO Need to Configure

#### 1. Site URL (Optional but Recommended)

In Supabase Dashboard → Authentication → URL Configuration:

**Site URL**: `http://localhost:3000` (development) or `https://yourdomain.com` (production)

This is used for:
- Email confirmation links
- Password reset links
- OAuth redirect validation

#### 2. Redirect URLs (Optional - for additional security)

If you want to restrict which URLs Supabase can redirect to, add these to **Redirect URLs**:

```
http://localhost:3000/*
https://yourdomain.com/*
```

This allows any path under your domain. You can be more specific if needed:

```
http://localhost:3000/api/auth/callback
http://localhost:3000/settings
https://yourdomain.com/api/auth/callback
https://yourdomain.com/settings
```

### GitHub OAuth Provider Setup

1. Go to [Authentication → Providers](https://supabase.com/dashboard/project/_/auth/providers)
2. Enable **GitHub**
3. Configure with your GitHub OAuth App credentials:
   - **Client ID**: From GitHub OAuth App
   - **Client Secret**: From GitHub OAuth App

### How It Works

The OAuth flow is now simplified:

```
┌─────────────────────────────────────────────────────────────────┐
│ OAuth Flow with Auto-Merge                                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. User clicks "Connect GitHub" in /settings                    │
│    → signInWithGithub({ userId: user.id })                      │
│    → Redirect URL: /api/auth/callback?target_user_id=xxx        │
│                                                                  │
│ 2. Redirects to GitHub OAuth                                    │
│    → GitHub authorization page                                  │
│    → User authorizes the app                                    │
│                                                                  │
│ 3. GitHub redirects to Supabase's callback                      │
│    → URL: https://[project].supabase.co/auth/v1/callback?code=  │
│    → Supabase exchanges code for session                        │
│    → Creates/retrieves user account                             │
│                                                                  │
│ 4. Supabase redirects to YOUR callback                          │
│    → URL: /api/auth/callback?target_user_id=xxx                 │
│    → Session already established via cookies                    │
│                                                                  │
│ 5. Your callback handler processes:                             │
│    a) If target_user_id provided → Link to existing account     │
│       - Transfer OAuth identity                                 │
│       - Merge all data (projects, chats, etc.)                  │
│       - Delete temporary OAuth account                          │
│    b) If email matches existing → Auto-merge                    │
│       - Same process as (a)                                     │
│    c) Otherwise → New user signup                               │
│       - Update user metadata                                    │
│       - Proceed normally                                        │
│                                                                  │
│ 6. Redirect to /settings or /login                              │
│    → Show success/error message                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### 1. Automatic Account Linking
When a logged-in user clicks "Connect GitHub", their current user ID is passed in the redirect URL. The callback handler automatically:
- Transfers the GitHub identity to the existing account
- Merges any data from the OAuth account
- Updates user metadata with GitHub info
- Deletes the temporary OAuth account

### 2. Email-Based Auto-Merge
If a user signs in with GitHub and an account already exists with the same email:
- Automatically merges the accounts
- No manual intervention required
- User sees a message to sign in with original credentials

### 3. Security
- Server-side identity transfer using admin client
- Validates target user exists before merging
- Audit logging for all merge operations
- Only transfers data when user IDs match or emails match

## Testing

### Test Account Linking
1. Sign up with email/password: `test@example.com`
2. Go to Settings
3. Click "Connect GitHub"
4. Authorize on GitHub
5. Should redirect back to Settings with GitHub connected
6. Sign out
7. Sign in with GitHub
8. Should sign into the same account

### Test Auto-Merge (Same Email)
1. Sign up with email/password: `test@example.com`
2. Sign out
3. Click "Sign in with GitHub" (using GitHub account with same email)
4. Should auto-merge and redirect to login
5. Sign in with original email/password
6. Go to Settings → should see GitHub connected

## Troubleshooting

### Error: "Invalid redirect URL"
- Check the Site URL in Supabase Authentication settings
- If you added specific redirect URLs, ensure your app's domain is included
- Remember: Supabase handles the actual OAuth callback, you just specify where it redirects AFTER authentication

### Error: "target_user_not_found"
- The user ID passed in the link request is invalid
- User may have been deleted or session expired
- Ask user to sign in again

### GitHub Already Connected
- If a user tries to link GitHub when it's already connected
- They will see "Connected" button (disabled)
- To re-link, they would need to sign out and try OAuth signup

## Migration from Old System

### Removed Files
The following files were removed as they're no longer needed:
- ❌ `app/auth/callback/route.ts` (moved to `app/api/auth/callback/route.ts`)
- ❌ `app/api/auth/link-identity/route.ts` (replaced by auto-merge)
- ❌ `app/api/auth/merge-accounts/route.ts` (replaced by auto-merge)
- ❌ `app/settings/accounts/page.tsx` (advanced UI not used)
- ❌ `docs/ACCOUNT_LINKING.md` (outdated)
- ❌ `docs/FLOW_COMPARISON.md` (outdated)

### Updated Files
- ✅ `lib/auth.ts` - Added `linkToAccount` parameter to `signInWithGithub()`
- ✅ `app/settings/settings-content.tsx` - Passes user ID when linking
- ✅ `app/api/auth/callback/route.ts` - New location with auto-merge logic

## Environment Variables

No changes to environment variables needed. Still requires:

```bash
# Public
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-only
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
