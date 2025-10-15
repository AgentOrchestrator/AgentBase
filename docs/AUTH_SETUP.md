# Authentication Setup Guide

This project now includes email/password authentication using Supabase.

## Features Implemented

- **User Registration** ([/register](app/register/page.tsx))
- **User Login** ([/login](app/login/page.tsx))
- **Auto Email Confirmation** (emails are automatically confirmed)
- **Session Management**

## Pages Created

1. **Login Page**: `/login`
   - Email and password login form
   - Link to registration page
   - Error handling and validation

2. **Registration Page**: `/register`
   - Email and password signup form
   - Password confirmation
   - Success notification
   - Auto-redirect after successful registration

## Files Added/Modified

### New Files:
- `lib/auth.ts` - Authentication utility functions
- `app/login/page.tsx` - Login page component
- `app/register/page.tsx` - Registration page component

### Authentication Functions (`lib/auth.ts`):
- `signUp(email, password)` - Register new user
- `signIn(email, password)` - Login existing user
- `signOut()` - Logout user
- `getCurrentUser()` - Get current authenticated user

## Supabase Configuration

### For Auto Email Confirmation:

#### Option 1: Supabase Dashboard (Production)
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Settings**
3. Scroll to **Email Auth** section
4. **Disable** "Confirm email" toggle

#### Option 2: Local Development (supabase/config.toml)
If you're using Supabase CLI locally, add this to your `supabase/config.toml`:

```toml
[auth]
enable_signup = true
enable_confirmations = false  # This auto-confirms emails
```

#### Option 3: Supabase CLI Command
Run this command to update local settings:

```bash
cd web
supabase init  # if not already initialized
# Edit the generated supabase/config.toml file as shown above
supabase start
```

## Environment Variables

Make sure your `.env.local` file contains:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Usage

### Register a New User

```typescript
import { signUp } from '@/lib/auth';

const result = await signUp('user@example.com', 'password123');
if (result.error) {
  console.error(result.error.message);
} else {
  // User is automatically logged in and email is confirmed
}
```

### Login

```typescript
import { signIn } from '@/lib/auth';

const result = await signIn('user@example.com', 'password123');
if (result.error) {
  console.error(result.error.message);
} else {
  // User is logged in
}
```

### Logout

```typescript
import { signOut } from '@/lib/auth';

await signOut();
```

### Get Current User

```typescript
import { getCurrentUser } from '@/lib/auth';

const { user, error } = await getCurrentUser();
if (user) {
  console.log('Logged in as:', user.email);
}
```

## Testing

1. Start the development server:
   ```bash
   cd web
   npm run dev
   ```

2. Navigate to `http://localhost:3000/register`

3. Create a new account with any email and password (min 6 characters)

4. You'll be automatically logged in and redirected to the home page

5. Test login at `http://localhost:3000/login`

## Security Notes

- Passwords must be at least 6 characters long
- Passwords are validated on both client and server side
- Email confirmation is disabled for easier testing and immediate user access
- For production, consider enabling email confirmation for better security

## Next Steps (Optional Enhancements)

- Add protected routes middleware
- Add user profile management
- Add password reset functionality
- Add social login providers (Google, GitHub, etc.)
- Add role-based access control (RBAC)
- Add email verification flow (if needed)
