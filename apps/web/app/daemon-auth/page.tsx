'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { createAuthSession } from './actions';

export default function DaemonAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceId = searchParams.get('device_id');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    authorize();
  }, [deviceId]);

  async function authorize() {
    if (!deviceId) {
      setError('Missing device ID. Please use the link provided by the daemon.');
      setStatus('error');
      return;
    }

    try {
      // Get current session from Supabase (client-side)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        // Redirect to login with return URL
        const redirectUrl = encodeURIComponent(`/daemon-auth?device_id=${deviceId}`);
        router.push(`/login?redirect=${redirectUrl}`);
        return;
      }

      console.log('[Client] Got session, calling server action...');

      // Pass session data to server action
      const result = await createAuthSession(
        deviceId,
        session.access_token,
        session.refresh_token,
        session.user.id,
        session.expires_at!
      );

      if (!result.success) {
        if (result.needsAuth) {
          const redirectUrl = encodeURIComponent(`/daemon-auth?device_id=${deviceId}`);
          router.push(`/login?redirect=${redirectUrl}`);
          return;
        }

        setError(result.error || 'Failed to authorize daemon');
        setStatus('error');
        return;
      }

      console.log('[Client] Server action succeeded!');
      setStatus('success');
    } catch (err) {
      console.error('Error authorizing daemon:', err);
      setError('An unexpected error occurred');
      setStatus('error');
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold mb-2">Authorizing daemon...</h1>
            <p className="text-gray-600 text-sm">This should only take a moment</p>
          </div>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold mb-2 text-green-600">Authorization Successful!</h1>
            <p className="text-gray-600 mb-6">
              Your daemon has been authorized. You can close this window and return to your terminal.
            </p>
            <div className="bg-green-50 border border-green-200 p-4 rounded mb-4">
              <p className="text-sm text-green-800">
                ✓ The daemon will now upload your chat histories with your account
              </p>
            </div>
            <Link href="/">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold mb-2 text-red-600">Authorization Failed</h1>
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
            <div className="space-y-2">
              <Link href={`/daemon-auth?device_id=${deviceId}`}>
                <Button className="w-full">Try Again</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="w-full">Go to Dashboard</Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}
