# Converting Web Directory to Git Submodule

## Current Situation

- `agent-orchestrator` (parent repo)
  - `agent-orchestrator-daemon/` ✅ Already a submodule
  - `web/` ❌ Currently just a directory in parent repo
  - `supabase/` - Database migrations and config

## Goal

Make `web` a separate Git repository and submodule, just like `agent-orchestrator-daemon`.

## Steps to Convert

### 1. Create a backup (optional but recommended)

```bash
cd /Users/duonghaidang/Developer/agent-orchestrator
cp -r web web-backup
```

### 2. Initialize web as a separate Git repository

```bash
cd /Users/duonghaidang/Developer/agent-orchestrator/web
git init
git add .
git commit -m "Initial commit: Extract web app from parent repo"
```

### 3. Create a remote repository (GitHub/GitLab)

Option A - GitHub CLI:
```bash
gh repo create agent-orchestrator-web --private --source=. --push
```

Option B - Manual:
1. Go to GitHub.com
2. Create new repository: `agent-orchestrator-web`
3. Copy the repository URL
4. Run:
   ```bash
   git remote add origin <your-repo-url>
   git branch -M main
   git push -u origin main
   ```

### 4. Remove web directory from parent repo

```bash
cd /Users/duonghaidang/Developer/agent-orchestrator
git rm -rf web
git commit -m "Remove web directory (converting to submodule)"
```

### 5. Add web as a submodule

```bash
cd /Users/duonghaidang/Developer/agent-orchestrator
git submodule add <your-web-repo-url> web
git commit -m "Add web as submodule"
```

### 6. Update .gitmodules

The `.gitmodules` file should now look like:

```ini
[submodule "agent-orchestrator-daemon"]
    path = agent-orchestrator-daemon
    url = <daemon-repo-url>

[submodule "web"]
    path = web
    url = <web-repo-url>
```

### 7. Push changes

```bash
git push origin main
```

## For Other Developers

When cloning the parent repository with submodules:

```bash
# Clone with submodules
git clone --recursive <parent-repo-url>

# Or if already cloned without --recursive
git submodule update --init --recursive
```

## Benefits of This Structure

✅ **Independent Versioning**: Web app has its own version history
✅ **Separate CI/CD**: Can deploy web independently of daemon
✅ **Team Permissions**: Different teams can have different access levels
✅ **Cleaner History**: Web commits don't clutter parent repo
✅ **Reusability**: Web app could be reused in other projects

## Automated Script

Create `scripts/convert-web-to-submodule.sh`:

```bash
#!/bin/bash
set -e

PARENT_DIR="/Users/duonghaidang/Developer/agent-orchestrator"
WEB_REPO_URL="$1"  # Pass as argument

if [ -z "$WEB_REPO_URL" ]; then
  echo "Usage: $0 <web-repo-url>"
  echo "Example: $0 https://github.com/yourusername/agent-orchestrator-web.git"
  exit 1
fi

echo "Step 1: Backup web directory..."
cd "$PARENT_DIR"
cp -r web web-backup

echo "Step 2: Initialize web as git repo..."
cd web
git init
git add .
git commit -m "Initial commit: Extract web app from parent repo"

echo "Step 3: Add remote..."
git remote add origin "$WEB_REPO_URL"
git branch -M main
git push -u origin main

echo "Step 4: Remove web from parent repo..."
cd "$PARENT_DIR"
git rm -rf web
git commit -m "Remove web directory (converting to submodule)"

echo "Step 5: Add web as submodule..."
git submodule add "$WEB_REPO_URL" web
git commit -m "Add web as submodule"

echo "Step 6: Push to parent repo..."
git push origin main

echo "Done! Web is now a submodule."
echo "Backup saved at: $PARENT_DIR/web-backup"
```

Make it executable:
```bash
chmod +x scripts/convert-web-to-submodule.sh
```

Run it:
```bash
./scripts/convert-web-to-submodule.sh https://github.com/yourusername/agent-orchestrator-web.git
```

## Alternative: Temporary Local Submodule (for testing)

If you want to test the submodule structure locally first:

```bash
cd /Users/duonghaidang/Developer/agent-orchestrator

# Initialize web as git repo
cd web
git init
git add .
git commit -m "Initial commit"
cd ..

# Remove from parent
git rm -rf web
git commit -m "Remove web (converting to submodule)"

# Add as local submodule
git submodule add file:///Users/duonghaidang/Developer/agent-orchestrator-web-repo web

# Later, update URL to remote
cd web
git remote set-url origin <remote-url>
git push -u origin main
```

## Notes

- Ensure all uncommitted changes in `web/` are committed before conversion
- The `.env.local` file in web is gitignored, so it won't be in the submodule
- After conversion, developers need to run `git submodule update --init` after cloning
