<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-images/agent_base_serif_white.png">
  <img src="./assets/logo-images/agent_base_serif.png" alt="Agent Base" width="500" style="margin-bottom: 50px;"/>
</picture>
</div>

**Stay in sync with your team's coding sessions — see what they're building in real-time**

When you're deep in flow working with AI agents, explaining what you're working on is the last thing you want to do. But your teammates need context. Agent Base gives your team transparency into everyone's AI conversations — what they're building, where they're stuck, and when they need help — without interrupting the flow.

<div align="center">
<img src="./assets/agent_base_1.png" alt="Agent Base" width="618"/>

<p align="center">
  <img src="./assets/agent_base_2.png" alt="Agent Base" width="364"/>
  <img src="./assets/agent_base_3.gif" alt="Agent Base" width="250"/>
</p>
<div align="left">
We built Agent Base to provide a quick overview of what all your and your teammates' agents are working on. You get real-time visibility, summaries that let you instantly understand the context of each conversation, and shared context that lets you jump into conversations with full context when pair programming or code reviews.

You can run Agent Base locally on your machine for personal development and testing, or connect to a shared Supabase instance for real-time team collaboration. The local setup keeps everything on your device, while the remote option lets your entire team see each other's agent conversations in real-time.
</div>

[![MIT License](https://img.shields.io/badge/License-MIT-555555.svg?labelColor=333333&color=666666)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/AgentOrchestrator/agent-orchestrator?labelColor=333333&color=666666)](https://github.com/AgentOrchestrator/agent-orchestrator)
[![Last Commit](https://img.shields.io/github/last-commit/AgentOrchestrator/agent-orchestrator?labelColor=333333&color=666666)](https://github.com/AgentOrchestrator/agent-orchestrator/commits/main)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/AgentOrchestrator/agent-orchestrator?labelColor=333333&color=666666)](https://github.com/AgentOrchestrator/agent-orchestrator/graphs/commit-activity)
[![Issues](https://img.shields.io/github/issues/AgentOrchestrator/agent-orchestrator?labelColor=333333&color=666666)](https://github.com/AgentOrchestrator/agent-orchestrator/issues)

[Installation](#-installation) • [Commands](#-available-commands) • [Preview](#-preview) • [Features](#-features) • [Integrations](#-integrations)
</div>


</div>

---

## 🚀 Installation

**Platform Compatibility:**
- ✅ **macOS** - Fully tested and supported
- 🚧 **Windows** - Coming soon
- 🚧 **Linux** - Coming soon

**Requirements**
- Supabase credentials (local or remote setup possible)

**Get your supabase credentials ready:**

For local Supabase:
```bash
# Install and start Supabase CLI first
brew install supabase/tap/supabase  # macOS
supabase start
supabase status -o env
```

For remote Supabase:
- Create project at [supabase.com](https://supabase.com)
- Get credentials from Project Settings → API

Choose your preferred installation method:

### 🐳 Docker based setup

**Prerequisites:** Docker and Docker Compose

```bash
git clone https://github.com/AgentOrchestrator/agentbase.git
cd agentbase

# 1. Copy environment file
cp .env.example .env
# Edit .env:
#   - Linux users: uncomment Linux paths, comment out macOS paths
#   - Optional: add Supabase credentials (defaults work for local)

# 2. Start all services
docker compose up -d
```

**Docker includes:**
- ✅ Daemon service
- ✅ Local Supabase database (port 54322)
- ✅ Supabase Studio (port 54323)

### 📦 npm/pnpm Installation (If you don't like to use docker)

```bash
git clone https://github.com/AgentOrchestrator/agentbase.git
cd agentbase

# Using pnpm (recommended - faster and more efficient)
pnpm install
pnpm run setup
pnpm run dev

# OR using npm
npm install
npm run setup
npm run dev
```


### Non-Interactive Setup (for coding assistants or CI/CD)

```bash
# Using environment variables (recommended)
export SUPABASE_URL=http://127.0.0.1:54321  # or your remote URL
export SUPABASE_ANON_KEY=eyJh...
export OPENAI_API_KEY=sk-xxx  # optional
pnpm run setup --non-interactive

# Using env file (recommended for CI/CD)
pnpm run setup --non-interactive -e .env.production

# Using CLI args (less secure - visible in process list)
pnpm run setup --non-interactive \
  --supabase-url https://xxx.supabase.co \
  --supabase-anon-key eyJh... \
  --openai-key sk-xxx
```

### Access points:
- **Supabase Studio** (local only): http://localhost:54323
- **Desktop App**: Launch the Electron desktop application

> **Note**: Authentication tokens are cached in `$HOME/.agent-orchestrator/auth.json` for persistent login sessions.

---

## 📋 Available Commands

### Docker Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start all services in background (detached mode) |
| `docker compose up` | Start all services with logs visible |
| `docker compose down` | Stop and remove all containers |
| `docker compose logs -f` | View logs from all services |
| `docker compose restart` | Restart all services |
| `docker compose down -v` | Stop services and remove volumes (fresh start) |
| `docker compose build` | Rebuild all Docker images |

### npm/pnpm Commands (Non-Docker)

All commands work with both **pnpm** (recommended) and **npm**. For npm, use `npm run <command>` instead of `pnpm <command>`.

| pnpm command | npm equivalent | Description |
|--------------|----------------|-------------|
| `pnpm install` | `npm install` | Install all dependencies for the monorepo |
| `pnpm run setup` | `npm run setup` | Interactive setup wizard - configures environment and Supabase |
| `pnpm dev` | `npm run dev` | Start all services in development mode (daemon + desktop with hot reload) |
| `pnpm dev:daemon` | `npm run dev:daemon` | Start only the daemon service in development mode |
| `pnpm dev:desktop` | `npm run dev:desktop` | Start only the desktop app in development mode |
| `pnpm build` | `npm run build` | Build all apps for production |
| `pnpm start` | `npm run start` | Start all services in production mode (requires build first) |

### Setup Flags

| Flag | Description |
|------|-------------|
| `--non-interactive` | Run setup without prompts (for CI/CD or coding assistants) |
| `--supabase-url <url>` | Supabase URL (required for non-interactive) |
| `--supabase-anon-key <key>` | Supabase anon key (required for non-interactive) |
| `-e, --env-file <path>` | Load environment variables from a file |
| `--openai-key <key>` | OpenAI API key (optional) |
| `--skip-openai` | Skip OpenAI API key setup (development mode) |
| `--help` | Show detailed help for the setup command |

---

## 💡 Why We Built This

**The Problem:** Max and I were hacking on a project together, jumping between features, debugging issues, and exploring new ideas with our AI coding assistants. The hardest part wasn't the code — it was staying aligned on what the other person was currently working on.

When you're in the zone with Claude Code or Cursor, articulating your current task in Slack feels like context-switching hell. "What are you working on?" becomes a difficult question to answer when you're mid-conversation with an AI, exploring multiple approaches, hitting roadblocks, and iterating rapidly.

**The Solution:** We built Agent Base to create transparency without the overhead. Instead of asking teammates to explain what they're doing, we can simply check the canvas:

- **Real-time visibility** - See who's working on what, right now
- **AI-powered summaries** - Instantly understand the context of each conversation without reading entire chat logs
- **Async collaboration** - Help teammates when they're stuck without interrupting their flow
- **Shared context** - Jump into conversations with full context when pair programming or code reviews

This is the tool we wished we had: a way to stay connected with our team's work without breaking the flow state that makes AI-assisted coding so productive.

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

Agent Base connects with your favorite AI coding assistants to provide real-time visibility into your team's development workflow.

### Supported AI Coding Assistants:

| Integration | Status | Description |
| ----------- | ------ | ----------- |
| [Claude Code](https://claude.ai/claude-code) | ✅ Supported | Anthropic's AI coding assistant - full integration with chat history tracking and real-time updates |
| [Cursor](https://cursor.sh) | ✅ Supported | AI-first code editor - tracks conversations and project context |
| [Codex](https://openai.com/blog/openai-codex) | ✅ Supported | OpenAI's code generation model - tracks chat history and project context |
| [FactoryDroid](https://www.factory.ai/) | ✅ Supported | Factory AI's coding agent - full integration with chat history tracking |
| [Windsurf](https://codeium.com/windsurf) | 🚧 Coming Soon | Codeium's AI coding assistant - integration in development |

### Integration Features:

| Feature | Claude Code | Cursor | Codex | Droid | Windsurf |
| ------- | ----------- | ------ | ----- | ------------ | -------- |
| Chat History Sync | ✅ | ✅ | ✅ | ✅ | 🚧 |
| Real-time Updates | ✅ | ✅ | ✅ | ✅ | 🚧 |
| AI Summaries      | ✅ | ✅ | ✅ | ✅ | 🚧 |
| Project Detection | ✅ | ✅ | ✅ | ✅ | 🚧 |
| File Change Tracking | 🚧  | 🚧 | 🚧 | 🚧 | 🚧 |

**Legend:**
- ✅ Fully supported
- 🚧 Coming soon
- ⏸️ Planned

Want to see your favorite AI assistant integrated? [Open an issue](https://github.com/AgentOrchestrator/agent-orchestrator/issues) or contribute via PR!

---

## ⚠️ Early Stage Project

**Note:** We recently started building this project and it's in active development. Expect things to move fast, break occasionally, and evolve rapidly. We welcome contributions, feedback, and ideas as we shape the future of team collaboration for AI-assisted coding!

---

## 🤝 Contributing

Contributions welcome! This is a monorepo, so all code lives in one place:
- **Backend (daemon)**: `apps/daemon/`
- **Desktop App**: `apps/desktop/`
- **CLI**: `apps/cli/`
- **Shared code**: `packages/shared/`

Please open an issue or PR in this repository!

---

<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/HaiandMax_white.png">
  <img src="./assets/HaiandMax.png" alt="Hai Dang & Max Prokopp" style="max-width: 400px; margin: 20px 0;"/>
</picture>
</div>

<div align="center">
We want to build tools that enhance the experience of ai working alongside humans.

Made with ❤️ from Munich and Palo Alto

</div>
