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

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AgentOrchestrator/agent-orchestrator.git
   cd agent-orchestrator
   ```

   > **Note**: This repository uses private submodules. Make sure you have access to both `agent-orchestrator-daemon` and `agent-orchestrator-web` repositories. Your existing Git credentials (SSH keys or tokens) will be used automatically.

2. **Run the installation script**:
   ```bash
   ./install.sh
   ```

   This will:
   - Pull git submodules (daemon and web)
   - Install Supabase CLI (if not already installed)
   - Start Supabase locally
   - Extract Supabase credentials
   - Prompt for your OpenAI API key
   - Create `.env` files automatically
   - Install all dependencies

3. **Start all services**:
   ```bash
   ./start.sh
   ```

   This will start:
   - Supabase (if not already running)
   - Backend daemon
   - Web application

4. **Access the application**:
   - **Web UI**: http://localhost:3000
   - **Supabase Studio**: http://localhost:54323

### Manual Setup (Alternative)

If you prefer manual setup or the script doesn't work for your environment:

<details>
<summary>Click to expand manual setup instructions</summary>

#### 1. Pull Submodules

```bash
git submodule update --init --recursive
```

#### 2. Install Supabase CLI

macOS:
```bash
brew install supabase/tap/supabase
```

Linux:
```bash
curl -fsSL https://supabase.com/install.sh | sh
```

#### 3. Start Supabase

```bash
supabase start
```

#### 4. Configure Environment Variables

Create `.env` files in the following locations:

**Root `.env`**:
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
```

**`agent-orchestrator-daemon/.env`**:
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon_key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key from supabase status>
OPENAI_API_KEY=<your_openai_api_key>
```

**`web/.env.local`**:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key from supabase status>
```

#### 5. Install Dependencies

```bash
# Web dependencies
cd web && npm install && cd ..

# Daemon dependencies
cd agent-orchestrator-daemon && npm install && cd ..
```

#### 6. Start Services

In separate terminals:

```bash
# Terminal 1: Daemon
cd agent-orchestrator-daemon
npm run dev

# Terminal 2: Web
cd web
npm run dev
```

</details>

### Stopping Services

To stop all services, press `Ctrl+C` in the terminal running `./start.sh`.

To stop Supabase:
```bash
supabase stop
```

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
