import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET /api/projects - List user's projects
// Query params: sort_by=latest_activity|created_at|name (default: latest_activity)
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get sort parameter from URL
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sort_by') || 'latest_activity';

    // Fetch user's own projects (we'll sort after enrichment for latest_activity)
    let query = supabase
      .from('projects')
      .select('id, name, description, project_path, created_at')
      .eq('user_id', user.id);

    // Apply sorting for non-activity sorts
    if (sortBy === 'created_at') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'name') {
      query = query.order('name', { ascending: true });
    } else {
      // For latest_activity, fetch all and sort after enrichment
      query = query.order('created_at', { ascending: false });
    }

    const { data: projects, error } = await query;

    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    // Enrich projects with share counts and sessions
    const projectsWithDetails = await Promise.all(
      (projects || []).map(async (project) => {
        // Count user shares
        const { count: userShareCount } = await supabase
          .from('project_shares')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id);

        // Count workspace shares
        const { count: workspaceShareCount } = await supabase
          .from('project_workspace_shares')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id);

        // Fetch sessions for this project
        const { data: sessions, error: sessionsError } = await supabase
          .from('chat_histories')
          .select('id, ai_title, ai_summary, latest_message_timestamp, created_at, agent_type')
          .eq('project_id', project.id)
          .order('latest_message_timestamp', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(10); // Limit to 10 most recent sessions per project

        if (sessionsError) {
          console.error('Error fetching sessions for project:', project.id, sessionsError);
        }

        // Enrich sessions with share counts
        const sessionsWithShares = await Promise.all(
          (sessions || []).map(async (session) => {
            // Count direct session shares
            const { count: userShareCount } = await supabase
              .from('session_shares')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', session.id);

            // Count workspace session shares
            const { count: workspaceShareCount } = await supabase
              .from('session_workspace_shares')
              .select('*', { count: 'exact', head: true })
              .eq('session_id', session.id);

            return {
              ...session,
              share_count: (userShareCount || 0) + (workspaceShareCount || 0),
            };
          })
        );

        // Get the latest activity timestamp from sessions
        const latestActivity = sessionsWithShares && sessionsWithShares.length > 0
          ? sessionsWithShares[0].latest_message_timestamp || sessionsWithShares[0].created_at
          : project.created_at;

        return {
          ...project,
          share_count: (userShareCount || 0) + (workspaceShareCount || 0),
          sessions: sessionsWithShares || [],
          latest_activity: latestActivity,
        };
      })
    );

    // Sort by latest activity if requested
    if (sortBy === 'latest_activity') {
      projectsWithDetails.sort((a, b) => {
        const dateA = new Date(a.latest_activity || a.created_at);
        const dateB = new Date(b.latest_activity || b.created_at);
        return dateB.getTime() - dateA.getTime(); // Descending order
      });
    }

    return NextResponse.json({ projects: projectsWithDetails });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
