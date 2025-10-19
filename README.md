<div align="center">

# 🤖 Agent Orchestrator

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/AgentOrchestrator/agent-orchestrator?style=social)](https://github.com/AgentOrchestrator/agent-orchestrator)
[![Last Commit](https://img.shields.io/github/last-commit/AgentOrchestrator/agent-orchestrator)](https://github.com/AgentOrchestrator/agent-orchestrator/commits/main)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/AgentOrchestrator/agent-orchestrator?labelColor=32b583&color=12b76a)](https://github.com/AgentOrchestrator/agent-orchestrator/graphs/commit-activity)
[![Issues](https://img.shields.io/github/issues/AgentOrchestrator/agent-orchestrator?labelColor=7d89b0&color=5d6b98)](https://github.com/AgentOrchestrator/agent-orchestrator/issues)

**Stay in sync with your team's AI coding sessions — see what they're building in real-time**

When you're deep in flow, vibe-coding with an AI assistant, explaining what you're working on is the last thing you want to do. But your teammates need context. Agent Orchestrator gives your team transparency into everyone's AI conversations — what they're building, where they're stuck, and when they need help — without interrupting the flow.

[Quick Start](#-quick-start) • [Preview](#-preview) • [Why We Built This](#-why-we-built-this) • [Features](#-features)

</div>

---

## 🚀 Quick Start

**Prerequisites:**
- **Node.js 18+** and **pnpm** (install with `npm install -g pnpm`)
- **Supabase CLI** for database management

Choose your setup mode:

### Using install script (Interactive):
 ```bash
 pnpm install
 pnpm install-cli
 pnpm start-cli
 ```

### Using install script (Non-Interactive/CI):
For CI/CD pipelines or automated setups:
 ```bash
 pnpm install
 # Using environment variables (recommended for secrets)
 OPENAI_API_KEY=sk-xxx pnpm install-cli:ci -- --local --skip-openai

 # Or with all environment variables
 export SUPABASE_URL=https://xxx.supabase.co
 export SUPABASE_ANON_KEY=eyJh...
 export OPENAI_API_KEY=sk-xxx
 pnpm install-cli:ci -- --remote
 ```

### 🏠 Option 1: Solo Development (Local Supabase)
Perfect for testing, personal use, or development. Runs entirely on your machine.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AgentOrchestrator/agent-orchestrator.git
   cd agent-orchestrator
   ```

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

   **`apps/daemon/.env`**:
   ```env
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_ANON_KEY=<anon_key from supabase status>
   OPENAI_API_KEY=<your_openai_api_key>
   ```

   **`apps/web/.env.local`**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key from supabase status>
   ```

5. **Install dependencies**:
   ```bash
   pnpm install
   ```

6. **Start the services**:

   ```bash
   # Option 1: Start all services (in separate terminals)
   pnpm dev:daemon
   pnpm dev:web

   # Option 2: Start everything in parallel with Turborepo
   pnpm dev
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
   ```

3. **Configure environment variables** (each team member):

   **Root `.env`**:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=<your_anon_key>
   SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
   ```

   **`apps/daemon/.env`**:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=<your_anon_key>
   OPENAI_API_KEY=<your_openai_api_key>
   ```

   **`apps/web/.env.local`**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
   ```

4. **Install dependencies** (each team member):
   ```bash
   pnpm install
   ```

5. **Start the services** (each team member):
   ```bash
   # Option 1: Start services in separate terminals
   pnpm dev:daemon
   pnpm dev:web

   # Option 2: Start everything in parallel
   pnpm dev
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

## 🔌 Integrations

Agent Orchestrator connects with your favorite AI coding assistants to provide real-time visibility into your team's development workflow.

### Supported AI Coding Assistants:

| Integration | Status | Description |
| ----------- | ------ | ----------- |
| [Claude Code](https://claude.ai/claude-code) | ✅ Supported | Anthropic's AI coding assistant - full integration with chat history tracking and real-time updates |
| [Cursor](https://cursor.sh) | ✅ Supported | AI-first code editor - tracks conversations and project context |
| [Windsurf](https://codeium.com/windsurf) | 🚧 Coming Soon | Codeium's AI coding assistant - integration in development |
| [Codex](https://openai.com/blog/openai-codex) | 🚧 Coming Soon | OpenAI's code generation model - integration planned |

### Integration Features:

| Feature | Claude Code | Cursor | Windsurf | Codex |
| ------- | ----------- | ------ | -------- | ----- |
| Chat History Sync | ✅ | ✅ | 🚧 | 🚧 |
| Real-time Updates | ✅ | ✅ | 🚧 | 🚧 |
| AI Summaries | ✅ | ✅ | 🚧 | 🚧 |
| Project Detection | ✅ | ✅ | 🚧 | 🚧 |
| File Change Tracking | ✅ | ✅ | 🚧 | 🚧 |

**Legend:**
- ✅ Fully supported
- 🚧 Coming soon
- ⏸️ Planned

Want to see your favorite AI assistant integrated? [Open an issue](https://github.com/AgentOrchestrator/agent-orchestrator/issues) or contribute via PR!

---

## 🏗️ Architecture

This is a **monorepo** using **pnpm workspaces** and **Turborepo**:

```
agent-orchestrator/
├── apps/
│   ├── cli/           # Installation and startup CLI
│   ├── daemon/        # Backend daemon - watches for chat histories
│   └── web/           # Next.js dashboard with real-time updates
├── packages/
│   └── shared/        # Shared types and utilities
└── supabase/          # Database migrations and config
```

- **[apps/daemon](./apps/daemon/)** - Watches for new chat histories and generates AI summaries
- **[apps/web](./apps/web/)** - Next.js dashboard with real-time updates via Supabase Realtime
- **[apps/cli](./apps/cli/)** - Interactive CLI for installation and setup
- **[packages/shared](./packages/shared/)** - Shared TypeScript types and utilities
- **supabase/** - PostgreSQL database with real-time capabilities

---

<details>
<summary><b>📚 Manual Setup (Advanced)</b></summary>

<br>

#### 1. Clone Repository

```bash
git clone https://github.com/AgentOrchestrator/agent-orchestrator.git
cd agent-orchestrator
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

**`apps/daemon/.env`**:
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<anon_key from supabase status>
OPENAI_API_KEY=<your_openai_api_key>
```

**`apps/web/.env.local`**:
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key from supabase status>
```

#### 5. Install Dependencies

```bash
pnpm install
```

#### 6. Start Services

```bash
# Start all services in parallel
pnpm dev

# Or start individually
pnpm dev:daemon
pnpm dev:web
```

</details>

---

## ⚠️ Early Stage Project

**Note:** We recently started building this project and it's in active development. Expect things to move fast, break occasionally, and evolve rapidly. We welcome contributions, feedback, and ideas as we shape the future of team collaboration for AI-assisted coding!

---

## 🤝 Contributing

Contributions welcome! This is a monorepo, so all code lives in one place:
- **Backend (daemon)**: `apps/daemon/`
- **Frontend (web)**: `apps/web/`
- **CLI**: `apps/cli/`
- **Shared code**: `packages/shared/`

Please open an issue or PR in this repository!

---

<div align="center">

Made with ❤️ from Munich and Palo Alto

</div>
