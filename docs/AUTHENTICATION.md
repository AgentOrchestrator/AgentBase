# Authentication Flow

This document describes how the Agent Orchestrator daemon authenticates users and associates chat histories with user accounts.

## Overview

The daemon now requires authentication before uploading chat histories to Supabase. This ensures that all messages are properly associated with the correct user account via the `account_id` field.

## How It Works

### 1. **First-Time Setup**

When you run the daemon for the first time (or when your auth token expires), you'll see:

```
🔐 Authentication Required
──────────────────────────────────────────────────
Opening browser for authentication...

URL: http://localhost:3000/daemon-auth?device_id=<unique-id>

If browser does not open, please copy the URL above.
Waiting for authentication...
──────────────────────────────────────────────────
```

**The daemon will automatically open your default browser!** If it doesn't open, you can manually copy and paste the URL.

### 2. **Browser Authentication**

1. Your browser opens automatically (or you open the URL manually)
2. If you're not logged in, you'll be redirected to the login page
3. Sign in or create a new account
4. After successful authentication, you'll see a success message
5. The daemon will automatically detect the authentication and continue

### 3. **Automatic Detection**

- The daemon polls the database every 2 seconds to check if authentication is complete
- Once detected, your auth tokens are securely stored locally in `~/.agent-orchestrator/auth.json`
- Future daemon runs will use the stored tokens automatically

### 4. **Token Management**

- Tokens are automatically refreshed when they expire
- If refresh fails, you'll be prompted to authenticate again
- Each device has a unique ID for security

## Architecture

### Components

1. **AuthManager** ([agent-orchestrator-daemon/src/auth-manager.ts](agent-orchestrator-daemon/src/auth-manager.ts))
   - Manages authentication state
   - Stores tokens in `~/.agent-orchestrator/auth.json`
   - Handles token refresh
   - Polls for auth completion

2. **Daemon Auth Page** ([web/app/daemon-auth/page.tsx](web/app/daemon-auth/page.tsx))
   - Web page that handles the auth flow
   - Creates a session record in `daemon_auth_sessions` table
   - Redirects to login/register if needed

3. **Database Table: daemon_auth_sessions**
   - Temporary storage for auth sessions
   - Links device_id to user credentials
   - Automatically cleaned up after 24 hours

### Flow Diagram

```
┌──────────┐          ┌─────────┐          ┌──────────┐
│  Daemon  │          │   Web   │          │ Supabase │
└────┬─────┘          └────┬────┘          └────┬─────┘
     │                     │                     │
     │ 1. Check auth       │                     │
     ├────────────────────►│                     │
     │                     │                     │
     │ 2. Not authenticated│                     │
     │◄────────────────────┤                     │
     │                     │                     │
     │ 3. Display auth URL │                     │
     │ (user opens in browser)                   │
     │                     │                     │
     │                     │ 4. User signs in    │
     │                     ├────────────────────►│
     │                     │                     │
     │                     │ 5. Create session   │
     │                     ├────────────────────►│
     │                     │                     │
     │ 6. Poll for auth    │                     │
     ├─────────────────────┼────────────────────►│
     │                     │                     │
     │ 7. Session found    │                     │
     │◄────────────────────┼─────────────────────┤
     │                     │                     │
     │ 8. Store tokens     │                     │
     │                     │                     │
     │ 9. Upload messages with account_id        │
     ├───────────────────────────────────────────►│
     │                     │                     │
```

## Security

### Token Storage

- Tokens are stored in `~/.agent-orchestrator/auth.json`
- File permissions should be restricted to the user
- Tokens include both access and refresh tokens

### Service Role Key

- The daemon uses the Supabase service role key to bypass RLS
- This is necessary to poll the `daemon_auth_sessions` table
- Service role key should never be exposed to the web app

### Row Level Security (RLS)

- The `daemon_auth_sessions` table has RLS enabled
- Users can only read/write their own sessions
- The daemon uses service role to bypass RLS for polling

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Daemon needs service role key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Web app URL for auth redirects
WEB_URL=http://localhost:3000
```

### Web App Configuration

The web app uses:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Troubleshooting

### "Authentication timeout"

- Make sure you opened the URL in your browser within 5 minutes
- Check that the web app is running at the correct URL
- Verify your `.env` file has the correct `WEB_URL`

### "Failed to authorize daemon"

- Check that Supabase is running
- Verify the migration was applied: `npx supabase db reset`
- Check browser console for errors

### Tokens not persisting

- Check file permissions on `~/.agent-orchestrator/auth.json`
- Make sure the directory is writable
- Try deleting the file and re-authenticating

## Manual Logout

To log out and remove stored credentials:

```bash
rm ~/.agent-orchestrator/auth.json
```

The next time you run the daemon, you'll be prompted to authenticate again.

## Development

### Testing the Auth Flow

1. Start Supabase: `npx supabase start`
2. Start the web app: `cd web && npm run dev`
3. Start the daemon: `cd agent-orchestrator-daemon && npm run dev`
4. Follow the authentication prompts

### Database Schema

The `daemon_auth_sessions` table:

```sql
CREATE TABLE daemon_auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  consumed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

The `chat_histories` table includes:

```sql
account_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
```

This links each chat history to the authenticated user.
