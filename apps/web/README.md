# Agent Orchestrator Web Dashboard

Real-time web dashboard for viewing your team's AI coding assistant conversations and summaries.

## What it does

- Displays team members' AI assistant conversations in real-time
- Shows AI-generated summaries for quick context
- Organizes chat histories by project
- Provides a read-only, secure interface to monitor team activity
- Built with Next.js App Router and Supabase Realtime

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment (create .env.local)
# See .env.example for required variables

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Environment Variables

Create `.env.local` with:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL + Realtime)
- **UI**: React, Tailwind CSS
- **Auth**: Supabase Auth

## Documentation

See the [main repository](https://github.com/AgentOrchestrator/agent-orchestrator) for full setup instructions and architecture details.
