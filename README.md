<div align="center">

# 🤖 Agent Orchestrator

**Ever co-vibed? Quickly gain overview of what your teammates are working on.**

Collaborate with agents across Claude Code, Cursor, and more (Windsurf, Codex coming soon) — view real-time chat histories with AI-powered summaries in a unified dashboard.

[Quick Start](#-quick-start) • [Preview](#-preview) • [Features](#-features) • [Architecture](#-architecture)

</div>

---

## 🚀 Quick Start

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

---

## 📸 Preview

> _Coming soon: Screenshots and demo of the web dashboard_

**What you'll see:**
- 👥 Team member activities across Claude Code, Cursor, and more
- 📊 Real-time chat history dashboard for all teammates
- 🔍 AI-generated summaries for each conversation
- 📁 Project-based organization for easy navigation
- ⚡ Live updates as your team codes with AI assistants

---

## ✨ Features

- **Team Collaboration** - See what your teammates are working on in real-time
- **Multi-Agent Support** - Works with Claude Code, Cursor (Windsurf & Codex coming soon)
- **AI Summaries** - GPT-4o-mini analyzes conversations and identifies key insights
- **Project Organization** - Chat histories grouped by project for easy navigation
- **Real-time Updates** - Live dashboard updates as teammates code with AI assistants
- **Secure by Design** - Read-only web UI, all secrets in backend daemon

---

## 🏗️ Architecture

This is a multi-repo system with submodules:

```
agent-orchestrator/           # Parent orchestrator repo
├── agent-orchestrator-daemon/  # Backend daemon (submodule)
├── web/                        # Web UI (submodule)
└── supabase/                   # Shared database migrations
```

- **[agent-orchestrator-daemon](./agent-orchestrator-daemon/)** - Watches for new chat histories and generates AI summaries
- **[web](./web/)** - Next.js dashboard with real-time updates
- **supabase/** - PostgreSQL database with real-time capabilities

---

<details>
<summary><b>📚 Manual Setup (Advanced)</b></summary>

<br>

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

---

## 🔒 Security Architecture

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

- ✅ **Web app** has read-only access (anon key)
- ✅ **Backend daemon** holds all secrets (service role key, OpenAI key)
- ✅ **OpenAI API calls** only from backend, never exposed to client

---

## 🛠️ Development

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

**Stop all services:** Press `Ctrl+C` in the terminal running `./start.sh`

**Stop Supabase:** `supabase stop`

---

## 📚 Documentation

- [AI Summary Feature](./AI_SUMMARY_README.md) - Detailed docs on AI-powered summaries
- [Daemon Repository](https://github.com/AgentOrchestrator/agent-orchestrator-daemon) - Backend service
- [Web UI Repository](https://github.com/AgentOrchestrator/agent-orchestrator-web) - Frontend dashboard

---

## 🤝 Contributing

Contributions welcome! Please open an issue or PR in the appropriate repository:
- **Architecture/Docs**: This repo
- **Backend**: agent-orchestrator-daemon
- **Frontend**: agent-orchestrator-web

---

<div align="center">

Made with ❤️ for AI coding assistants

</div>
