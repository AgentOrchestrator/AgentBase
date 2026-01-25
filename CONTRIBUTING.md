# Contributing to Agent Base

Thank you for contributing to Agent Base! This guide will help you get started.

## Quick Start

### 1. Fork & Clone

![Fork Button Location](docs/images/fork-button-location.png)

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/AgentBase.git
cd AgentBase
git remote add upstream https://github.com/AgentOrchestrator/AgentBase.git
```

### 2. Setup

```bash
npm install
cp .env.local.example .env  # Use local SQLite for development
npm run dev                 # Start daemon + desktop app
```

### 3. Make Changes

```bash
git checkout -b feature/your-feature-name
# Make your changes...
npm run build  # Test that it builds
```

### 4. Submit PR

```bash
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## ⚠️ Critical: Enable "Allow edits by maintainers"

When creating your PR, **you must check this box** in the right sidebar:

![Allow Edits by Maintainers Checkbox](https://docs.github.com/assets/cb-87213/mw-1440/images/help/pull_requests/allow-maintainers-to-make-edits-sidebar-checkbox.webp)

**Why it matters:**
- Maintainers can fix small issues (typos, linting) directly
- Dramatically speeds up merge process
- You still get full credit for your work

**Don't see the checkbox?**
- Only visible on forks from personal accounts (not organizations)
- Make sure your fork is public, not private

## Code Guidelines

Full guidelines in [AGENTS.md](AGENTS.md). Key points:

### Component Architecture
- **Components**: UI only, no business logic
- **Services**: Business logic, API calls
- **Stores**: Global state management

### Type Definitions
- Never define domain types in `*.d.ts` files
- Use `.d.ts` only to connect runtime objects to imported types

### Avoid Spread Operator
```typescript
// ✅ Good - explicit
const updated = { id: agent.id, name: agent.name, status: 'active' };

// ❌ Avoid - hides what's replaced
const updated = { ...agent, status: 'active' };
```

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat(desktop): add new feature
fix(daemon): resolve bug
docs: update guide
refactor(shared): improve code
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

**Scopes:** `daemon`, `desktop`, `shared`, `deps`

## Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `chore/` - Maintenance

## Need Help?

- Check [AGENTS.md](AGENTS.md) for architecture
- Browse [GitHub Issues](https://github.com/AgentOrchestrator/AgentBase/issues)
- Start a [Discussion](https://github.com/AgentOrchestrator/AgentBase/discussions)

---

By contributing, you agree your contributions will be licensed under the [MIT License](LICENSE).
