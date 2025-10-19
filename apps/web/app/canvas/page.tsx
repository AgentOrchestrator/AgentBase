import CanvasFlow from '@/components/canvas-flow';
import { createClient } from '@/lib/supabase-server';
import { ChatHistory } from '@/lib/supabase';
import { CanvasWrapper } from '@/components/canvas-wrapper';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

interface UserWithMessages {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
  recentMessages: ChatHistory[];
}

/**
 * Gets users and their accessible chat histories by calling the API route.
 * This avoids code duplication and ensures consistent behavior.
 */
async function getUsersWithAccessibleMessages(): Promise<UserWithMessages[]> {
  try {
    // Get the session cookies for authentication
    const cookieStore = await cookies();
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.error('No session found');
      return [];
    }

    // Call the internal API route
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/canvas/data`, {
      headers: {
        'Cookie': cookieStore.toString(),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch canvas data:', response.statusText);
      return [];
    }

    const result = await response.json();
    if (result.success) {
      return result.data;
    } else {
      console.error('API returned error:', result.error);
      return [];
    }
  } catch (error) {
    console.error("Error fetching users with accessible messages:", error);
    return [];
  }
}

export default async function CanvasPage() {
  // Get authenticated user
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (authError || !user) {
    redirect('/login');
  }

  // Get accessible messages respecting RLS with share counts
  const usersWithMessages = await getUsersWithAccessibleMessages();

  // Debug logging
  // console.log('Canvas page - users with accessible messages:', usersWithMessages.length);
  // console.log('Users data:', usersWithMessages.map((u: UserWithMessages) => ({
  //   id: u.id,
  //   email: u.email,
  //   display_name: u.display_name,
  //   messageCount: u.recentMessages.length
  // })));

  // If no users with messages, show empty canvas
  if (usersWithMessages.length === 0) {
    console.log('No accessible messages found for user');
    return (
      <CanvasWrapper>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded m-4">
          <h2 className="text-lg font-bold text-blue-800">Canvas</h2>
          <p className="text-blue-700">No sessions found. Start a conversation to see it here.</p>
        </div>
        <CanvasFlow usersWithMessages={[]} initialData={[]} />
      </CanvasWrapper>
    );
  }

  return (
    <CanvasWrapper>
      <CanvasFlow usersWithMessages={usersWithMessages} initialData={usersWithMessages} />
    </CanvasWrapper>
  );
}
