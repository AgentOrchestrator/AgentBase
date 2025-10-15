# Agent Orchestrator Project Instructions

## Multi-Repo Structure
This is a multi-repo setup. The {workspace} folder is the parent module and has multiple submodules.

### Submodules
- agent-orchestrator-daemon
- web

### Working with Submodules
**IMPORTANT**: When making changes to files within a submodule:
- Navigate to the submodule directory (e.g., `cd agent-orchestrator-daemon` or `cd web`)
- Create branches, commit, and push from within that submodule
- **Do NOT commit submodule changes in the parent repository**

Only commit to the parent repository when:
- Changing files directly in the parent (e.g., cli/, root config files)
- Updating submodule references (after submodule has been pushed)
- When making changes across submodules, ensure commits are properly coordinated

## Git Workflow

### Branch Management
- **Always create a new branch** for any code edits or features
- Branch naming convention: Use descriptive names (e.g., `feature/add-auth`, `fix/install-env-vars`, `refactor/cleanup-types`)
- **Never commit directly to main branch**
- After completing work, merge the branch with main before pushing
- Delete feature branches after successful merge to keep the repository clean

### Workflow Steps
1. Create a new branch: `git checkout -b <descriptive-branch-name>`
2. Make your changes and commit them
3. Switch to main: `git checkout main`
4. Merge your feature branch: `git merge <your-branch-name>`
5. Push to remote: `git push origin main`
6. Delete the feature branch: `git branch -d <your-branch-name>`

## Code Standards
- Follow existing code conventions in the repository
- Ensure TypeScript types are properly defined
- Run tests before merging branches
- Update documentation when adding new features

## Additional Notes
- Handling Cursor Messages in CURSOR_MESSAGES.md