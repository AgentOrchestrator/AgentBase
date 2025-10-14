# Agent Orchestrator

A multi-repository system for managing AI coding assistant chat histories with real-time web UI and intelligent AI summaries.

## Architecture

This is an **orchestrator repository** containing multiple submodules and shared infrastructure:

```
agent-orchestrator/           # Parent orchestrator repo
├── agent-orchestrator-daemon/  # Backend daemon (submodule)
├── web/                        # Web UI (submodule)
├── supabase/                   # Shared database migrations
├── AI_SUMMARY_README.md        # AI summary feature documentation
└── README.md                   # This file
```

### Submodules

- **[agent-orchestrator-daemon](./agent-orchestrator-daemon/)** - Backend service that watches for new chat histories, uploads to Supabase, and generates AI summaries
- **[web](./web/)** - Next.js web application for viewing chat histories with real-time updates

### Shared Infrastructure

- **supabase/** - PostgreSQL database migrations and configuration
  - Chat history storage
  - Real-time subscriptions
  - AI summary fields

## Getting Started

### Initial Clone

Clone the repository with all submodules:

```bash
git clone --recursive https://github.com/AgentOrchestrator/agent-orchestrator.git
cd agent-orchestrator
```

Or if you already cloned without `--recursive`:

```bash
git clone https://github.com/AgentOrchestrator/agent-orchestrator.git
cd agent-orchestrator
git submodule update --init --recursive
```

### Setup Supabase

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Start local Supabase:
   ```bash
   cd supabase
   supabase start
   ```

3. Note the credentials displayed (URL, anon key, service role key)

### Setup Daemon

The daemon handles chat history uploads and AI summary generation:

```bash
cd agent-orchestrator-daemon

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials and OpenAI API key

# Run the daemon
npm run dev
```

**Required Environment Variables:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for write access)
- `OPENAI_API_KEY` - OpenAI API key for GPT-4o-mini summaries

### Setup Web UI

The web app displays chat histories with real-time updates:

```bash
cd web

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase public credentials

# Run the web server
npm run dev
```

**Required Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key (read-only access)

### Access the Application

- **Web UI**: http://localhost:3000
- **Supabase Studio**: http://localhost:54323

## Features

### 1. Chat History Management

- Automatic upload of Claude Code chat histories to Supabase
- Real-time synchronization across devices
- Grouping by project path
- Session metadata tracking (agent type, timestamps)

### 2. AI-Powered Summaries

- GPT-4o-mini analyzes each chat session
- Identifies user intent and problems
- Tracks progress patterns (making progress vs. stuck)
- Automatic updates every 5 minutes for recent sessions
- **Secure**: All AI processing happens in the backend daemon

See [AI_SUMMARY_README.md](./AI_SUMMARY_README.md) for detailed documentation.

### 3. Real-Time Web UI

- Live updates using Supabase real-time subscriptions
- Project-based grouping with collapsible sections
- Relative timestamps ("5 minutes ago")
- Session detail view with full conversation history

## Security Architecture

```
┌─────────────┐                    ┌──────────────────┐
│   Web App   │◄───Read Only───────┤    Supabase      │
│ (Public)    │   (Anon Key)       │   (Database)     │
└─────────────┘                    └──────────────────┘
                                            ▲
                                            │
                                     Write + AI Process
                                            │
                                    ┌───────┴──────────┐
                                    │  Backend Daemon  │
                                    │  (Secrets Here)  │
                                    │  - Service Key   │
                                    │  - OpenAI Key    │
                                    └──────────────────┘
```

**Security Best Practices:**
- ✅ Web app only has read-only access (anon key)
- ✅ All secrets stored in backend daemon only
- ✅ Service role key never exposed to client
- ✅ OpenAI API calls only from backend

## Development Workflow

### Working with Submodules

Each submodule is an independent Git repository:

```bash
# Update all submodules to latest
git submodule update --remote

# Work in a submodule
cd agent-orchestrator-daemon
git checkout -b feature/new-feature
# Make changes, commit, push
git push origin feature/new-feature

# Update parent repo to point to new submodule commit
cd ..
git add agent-orchestrator-daemon
git commit -m "Update daemon to latest"
```

### Database Migrations

Add new migrations in the `supabase/migrations/` directory:

```bash
cd supabase
supabase migration new my_new_migration
# Edit the generated SQL file
supabase db reset  # Apply migrations locally
```

### Making Changes

1. **Backend changes**: Work in `agent-orchestrator-daemon/` submodule
2. **Frontend changes**: Work in `web/` submodule
3. **Database changes**: Add migrations to `supabase/migrations/`
4. **Update parent**: Commit submodule pointer updates when needed

## Repository Structure Rationale

This multi-repo (submodule) structure provides:

✅ **Independent Versioning** - Each component has its own version history
✅ **Separate CI/CD** - Deploy daemon and web independently
✅ **Team Permissions** - Different teams can have different access levels
✅ **Cleaner History** - Component commits don't clutter the main repo
✅ **Reusability** - Components can be reused in other projects
✅ **Shared Infrastructure** - Database migrations stay in parent repo

## Contributing

1. Fork the appropriate repository (parent or submodule)
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[Your License Here]

## Support

- **Issues**: Report bugs in the appropriate repository
  - Parent repo issues: Overall architecture, documentation
  - Daemon issues: Backend processing, AI summaries
  - Web issues: Frontend bugs, UI/UX

## Links

- [Agent Orchestrator Daemon Repository](https://github.com/AgentOrchestrator/agent-orchestrator-daemon)
- [Web UI Repository](https://github.com/AgentOrchestrator/agent-orchestrator-web)
- [AI Summary Documentation](./AI_SUMMARY_README.md)
