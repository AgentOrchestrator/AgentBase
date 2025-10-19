import { supabase } from './supabase';

export interface AuthError {
  message: string;
}

export interface AuthResult {
  error?: AuthError;
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: {
        email_confirmed: true,
      },
    },
  });

  if (error) {
    return { error: { message: error.message } };
  }

  return {};
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: { message: error.message } };
  }

  return {};
}

export async function signOut(): Promise<AuthResult> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: { message: error.message } };
  }

  return {};
}

/**
 * Link GitHub account to the currently logged-in user
 *
 * Uses Supabase's built-in linkIdentity() which properly handles
 * linking OAuth providers to existing accounts.
 */
export async function linkGithubAccount(): Promise<AuthResult> {
  const { error } = await supabase.auth.linkIdentity({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/settings`,
      scopes: 'user',
    },
  });

  if (error) {
    return { error: { message: error.message } };
  }

  return {};
}

/**
 * Sign in with GitHub OAuth (for non-logged-in users)
 */
export async function signInWithGithub(): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });

  if (error) {
    return { error: { message: error.message } };
  }

  return {};
}

/**
 * Unlink GitHub identity from the currently logged-in user
 *
 * Note: User must have at least 2 linked identities to unlink one.
 * This prevents users from losing all access to their account.
 *
 * This also cleans up all GitHub-related metadata from the user's profile.
 */
export async function unlinkGithubAccount(): Promise<AuthResult> {
  try {
    const response = await fetch('/api/auth/unlink-github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: { message: data.error || 'Failed to unlink GitHub account' } };
    }

    if (data.warning) {
      console.warn('Unlink warning:', data.warning);
    }

    return {};
  } catch {
    return { error: { message: 'Failed to unlink GitHub account. Please try again.' } };
  }
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    return { user: null, error: { message: error.message } };
  }

  return { user, error: null };
}
