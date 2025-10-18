<div align="center">

# 🤖 Agent Orchestrator

**Stay in sync with your team's AI coding sessions — see what they're building in real-time**

When you're deep in flow, vibe-coding with an AI assistant, explaining what you're working on is the last thing you want to do. But your teammates need context. Agent Orchestrator gives your team transparency into everyone's AI conversations — what they're building, where they're stuck, and when they need help — without interrupting the flow.

[Quick Start](#-quick-start) • [Preview](#-preview) • [Why We Built This](#-why-we-built-this) • [Features](#-features)

</div>

---

## 🚀 Quick Start

Choose your setup mode:

### Using install script:
 ```bash
 npm install
 npm run install-cli
 npm run start-cli
 ```

### 🏠 Option 1: Solo Development (Local Supabase)
Perfect for testing, personal use, or development. Runs entirely on your machine.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AgentOrchestrator/agent-orchestrator.git
   cd agent-orchestrator
   git submodule update --init --recursive
   ```

   > **Note**: This repository uses private submodules. Make sure you have access to both `agent-orchestrator-daemon` and `web` repositories. Your existing Git credentials (SSH keys or tokens) will be used automatically.

2. **Install Supabase CLI** (if not already installed):

   macOS:
   ```bash
   brew install supabase/tap/supabase
   ```

   Linux:
   ```bash
   curl -fsSL https://supabase.com/install.sh | sh
   ```

3. **Start Supabase locally**:
   ```bash
   supabase start
   ```

4. **Configure environment variables**:

   Create `.env` files in the following locations with credentials from `supabase status`:

   **Root `.env`**:
   ```env
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_ANON_KEY=<from supabase status>
   SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
   ```

   **`agent-orchestrator-daemon/.env`**:
   ```env
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_ANON_KEY=<anon_key from supabase status>
   OPENAI_API_KEY=<your_openai_api_key>
   ```

   **`web/.env.local`**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key from supabase status>
   ```

5. **Install dependencies**:
   ```bash
   cd web && npm install && cd ..
   cd agent-orchestrator-daemon && npm install && cd ..
   ```

6. **Start the services** (in separate terminals):

   ```bash
   # Terminal 1: Daemon
   cd agent-orchestrator-daemon && npm run dev

   # Terminal 2: Web
   cd web && npm run dev
   ```

7. **Access the application**:
   - **Web UI**: http://localhost:3000
   - **Supabase Studio**: http://localhost:54323

   > **Note**: Authentication tokens are cached in `$HOME/.agent-orchestrator/auth.json` for persistent login sessions.

### 👥 Option 2: Team Collaboration (Hosted Supabase)
For real team collaboration where multiple developers can see each other's AI conversations in real-time.

1. **Set up Supabase project** (one person does this):
   - Create a project at [supabase.com](https://supabase.com)
   - Go to Project Settings → API
   - Note your `Project URL`, `anon/public key`, and `service_role key`
   - Go to Project Settings → Database and run the migrations from `supabase/migrations/`

2. **Clone the repository** (each team member):
   ```bash
   git clone https://github.com/AgentOrchestrator/agent-orchestrator.git
   cd agent-orchestrator
   git submodule update --init --recursive
   ```

3. **Configure environment variables** (each team member):

   **Root `.env`**:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=<your_anon_key>
   SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
   ```

   **`agent-orchestrator-daemon/.env`**:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=<your_anon_key>
   OPENAI_API_KEY=<your_openai_api_key>
   ```

   **`web/.env.local`**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
   ```

4. **Install dependencies** (each team member):
   ```bash
   cd web && npm install && cd ..
   cd agent-orchestrator-daemon && npm install && cd ..
   ```

5. **Start the services** (each team member):
   ```bash
   # Terminal 1: Daemon
   cd agent-orchestrator-daemon && npm run dev

   # Terminal 2: Web
   cd web && npm run dev
   ```

6. **Access the shared dashboard**:
   - **Web UI**: http://localhost:3000
   - All team members will see each other's AI conversations in real-time!

---

## 💡 Why We Built This

**The Problem:** Max and I were hacking on a project together, jumping between features, debugging issues, and exploring new ideas with our AI coding assistants. The hardest part wasn't the code — it was staying aligned on what the other person was currently working on.

When you're in the zone with Claude Code or Cursor, articulating your current task in Slack feels like context-switching hell. "What are you working on?" becomes a difficult question to answer when you're mid-conversation with an AI, exploring multiple approaches, hitting roadblocks, and iterating rapidly.

**The Solution:** We built Agent Orchestrator to create transparency without the overhead. Instead of asking teammates to explain what they're doing, we can simply check the dashboard:

- **Real-time visibility** - See who's working on what, right now
- **AI-powered summaries** - Instantly understand the context of each conversation without reading entire chat logs
- **Async collaboration** - Help teammates when they're stuck without interrupting their flow
- **Shared context** - Jump into conversations with full context when pair programming or code reviews

This is the tool we wished we had: a way to stay connected with our team's work without breaking the flow state that makes AI-assisted coding so productive.

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

- **👥 Team Collaboration** - See what your teammates are working on in real-time with shared Supabase backend
- **🤖 Multi-Agent Support** - Works with Claude Code, Cursor (Windsurf & Codex coming soon)
- **🧠 AI Summaries** - GPT-4o-mini analyzes conversations and identifies key insights
- **📁 Project Organization** - Chat histories grouped by project for easy navigation
- **⚡ Real-time Updates** - Live dashboard updates as teammates code with AI assistants
- **🔒 Secure by Design** - Read-only web UI, all secrets in backend daemon
- **🏠 Flexible Deployment** - Run locally for solo work or use hosted Supabase for team collaboration

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

## ⚠️ Early Stage Project

**Note:** We recently started building this project and it's in active development. Expect things to move fast, break occasionally, and evolve rapidly. We welcome contributions, feedback, and ideas as we shape the future of team collaboration for AI-assisted coding!

---

## 🤝 Contributing

Contributions welcome! Please open an issue or PR in the appropriate repository:
- **Backend**: agent-orchestrator-daemon
- **Frontend**: agent-orchestrator-web

---

<div align="center">

Made with ❤️ from Munich and San Francisco

</div>
