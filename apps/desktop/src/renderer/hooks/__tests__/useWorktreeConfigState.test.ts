/**
 * Acceptance Tests for WorktreeConfigState Store
 *
 * These tests define the expected behavior for the worktree configuration
 * Zustand store used in the New Agent Modal.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useWorktreeConfigState } from '../useWorktreeConfigState';

describe('useWorktreeConfigState', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useWorktreeConfigState.getState().reset();
  });

  afterEach(() => {
    useWorktreeConfigState.getState().reset();
  });

  describe('initial state', () => {
    it('should have worktree disabled by default', () => {
      const state = useWorktreeConfigState.getState();
      expect(state.enabled).toBe(false);
    });

    it('should have empty branch and folder names by default', () => {
      const state = useWorktreeConfigState.getState();
      expect(state.branchName).toBe('');
      expect(state.folderName).toBe('');
    });

    it('should not have manually edited flags set', () => {
      const state = useWorktreeConfigState.getState();
      expect(state.branchManuallyEdited).toBe(false);
      expect(state.folderManuallyEdited).toBe(false);
    });
  });

  describe('setEnabled', () => {
    it('should enable worktree creation', () => {
      useWorktreeConfigState.getState().setEnabled(true);
      expect(useWorktreeConfigState.getState().enabled).toBe(true);
    });

    it('should disable worktree creation', () => {
      useWorktreeConfigState.getState().setEnabled(true);
      useWorktreeConfigState.getState().setEnabled(false);
      expect(useWorktreeConfigState.getState().enabled).toBe(false);
    });
  });

  describe('setBranchName', () => {
    it('should update branch name', () => {
      useWorktreeConfigState.getState().setBranchName('feature/my-branch');
      expect(useWorktreeConfigState.getState().branchName).toBe('feature/my-branch');
    });

    it('should mark branch as manually edited by default', () => {
      useWorktreeConfigState.getState().setBranchName('feature/my-branch');
      expect(useWorktreeConfigState.getState().branchManuallyEdited).toBe(true);
    });

    it('should not mark as manually edited when manual=false', () => {
      useWorktreeConfigState.getState().setBranchName('feature/auto-branch', false);
      expect(useWorktreeConfigState.getState().branchManuallyEdited).toBe(false);
    });
  });

  describe('setFolderName', () => {
    it('should update folder name', () => {
      useWorktreeConfigState.getState().setFolderName('my-project-feature');
      expect(useWorktreeConfigState.getState().folderName).toBe('my-project-feature');
    });

    it('should mark folder as manually edited by default', () => {
      useWorktreeConfigState.getState().setFolderName('my-project-feature');
      expect(useWorktreeConfigState.getState().folderManuallyEdited).toBe(true);
    });

    it('should not mark as manually edited when manual=false', () => {
      useWorktreeConfigState.getState().setFolderName('auto-folder', false);
      expect(useWorktreeConfigState.getState().folderManuallyEdited).toBe(false);
    });
  });

  describe('updateDefaults', () => {
    it('should generate branch name from description', () => {
      useWorktreeConfigState.getState().updateDefaults('Fix auth bug', 'my-project');

      const state = useWorktreeConfigState.getState();
      expect(state.branchName).toBe('feature/fix-auth-bug');
    });

    it('should generate folder name from project and description', () => {
      useWorktreeConfigState.getState().updateDefaults('Fix auth bug', 'my-project');

      const state = useWorktreeConfigState.getState();
      expect(state.folderName).toBe('my-project-fix-auth-bug');
    });

    it('should sanitize special characters in description', () => {
      useWorktreeConfigState.getState().updateDefaults('Fix @#$% auth & login!!!', 'project');

      const state = useWorktreeConfigState.getState();
      expect(state.branchName).toBe('feature/fix-auth-login');
      expect(state.folderName).toBe('project-fix-auth-login');
    });

    it('should truncate long descriptions to 30 characters', () => {
      useWorktreeConfigState
        .getState()
        .updateDefaults('This is a very long description that should be truncated', 'proj');

      const state = useWorktreeConfigState.getState();
      // Sanitized text should be max 30 chars
      expect(state.branchName.replace('feature/', '').length).toBeLessThanOrEqual(30);
      expect(state.folderName.replace('proj-', '').length).toBeLessThanOrEqual(30);
    });

    it('should NOT update branch name if manually edited', () => {
      // User manually edits branch name
      useWorktreeConfigState.getState().setBranchName('my-custom-branch');

      // Then description changes
      useWorktreeConfigState.getState().updateDefaults('New description', 'project');

      // Branch should preserve user's edit
      expect(useWorktreeConfigState.getState().branchName).toBe('my-custom-branch');
    });

    it('should NOT update folder name if manually edited', () => {
      // User manually edits folder name
      useWorktreeConfigState.getState().setFolderName('my-custom-folder');

      // Then description changes
      useWorktreeConfigState.getState().updateDefaults('New description', 'project');

      // Folder should preserve user's edit
      expect(useWorktreeConfigState.getState().folderName).toBe('my-custom-folder');
    });

    it('should generate fallback names when description is empty', () => {
      useWorktreeConfigState.getState().updateDefaults('', 'my-project');

      const state = useWorktreeConfigState.getState();
      // Should have timestamp-based fallback
      expect(state.branchName).toMatch(/^feature\/agent-\d+$/);
      expect(state.folderName).toMatch(/^my-project-agent-\d+$/);
    });

    it('should handle whitespace-only description', () => {
      useWorktreeConfigState.getState().updateDefaults('   ', 'project');

      const state = useWorktreeConfigState.getState();
      expect(state.branchName).toMatch(/^feature\/agent-\d+$/);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      // Set various state
      useWorktreeConfigState.getState().setEnabled(true);
      useWorktreeConfigState.getState().setBranchName('feature/test');
      useWorktreeConfigState.getState().setFolderName('test-folder');

      // Reset
      useWorktreeConfigState.getState().reset();

      // Verify all reset
      const state = useWorktreeConfigState.getState();
      expect(state.enabled).toBe(false);
      expect(state.branchName).toBe('');
      expect(state.folderName).toBe('');
      expect(state.branchManuallyEdited).toBe(false);
      expect(state.folderManuallyEdited).toBe(false);
    });
  });

  describe('user workflow scenarios', () => {
    it('should support basic workflow: enable -> auto-fill -> start', () => {
      // User checks "Create as worktree"
      useWorktreeConfigState.getState().setEnabled(true);
      expect(useWorktreeConfigState.getState().enabled).toBe(true);

      // Description auto-fills names
      useWorktreeConfigState.getState().updateDefaults('Add login feature', 'app');

      const state = useWorktreeConfigState.getState();
      expect(state.branchName).toBe('feature/add-login-feature');
      expect(state.folderName).toBe('app-add-login-feature');
    });

    it('should support workflow: enable -> auto-fill -> edit -> preserve edits', () => {
      useWorktreeConfigState.getState().setEnabled(true);
      useWorktreeConfigState.getState().updateDefaults('Initial desc', 'app');

      // User edits the branch name
      useWorktreeConfigState.getState().setBranchName('feature/custom-name');

      // Description changes again
      useWorktreeConfigState.getState().updateDefaults('Changed description', 'app');

      // Branch preserved, folder updated
      const state = useWorktreeConfigState.getState();
      expect(state.branchName).toBe('feature/custom-name');
      expect(state.folderName).toBe('app-changed-description');
    });

    it('should support modal close -> reopen flow', () => {
      // First session
      useWorktreeConfigState.getState().setEnabled(true);
      useWorktreeConfigState.getState().setBranchName('feature/first-session');

      // Modal closes
      useWorktreeConfigState.getState().reset();

      // Modal reopens - should be clean slate
      const state = useWorktreeConfigState.getState();
      expect(state.enabled).toBe(false);
      expect(state.branchName).toBe('');
      expect(state.branchManuallyEdited).toBe(false);
    });
  });
});
