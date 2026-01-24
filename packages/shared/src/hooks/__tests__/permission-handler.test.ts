/**
 * Permission Handler Tests
 *
 * Tests for the permission handler creation, evaluation, and helper functions.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionPolicy } from '../policy.js';
import { PERMISSION_PRESETS } from '../policy.js';
import {
  createAlwaysAllowHandler,
  createAlwaysDenyHandler,
  createAlwaysAskHandler,
  createPermissionHandler,
  getCommandRiskAssessment,
  isDangerousCommand,
  isSafeCommand,
} from '../handlers/permission-handler.js';
import type { AgentEvent, PermissionPayload } from '../types.js';

// Helper to create a mock agent event
const createMockEvent = (payload: Partial<PermissionPayload> = {}): AgentEvent<PermissionPayload> => ({
  id: 'test-event-123',
  type: 'permission:request',
  agent: 'claude_code',
  timestamp: new Date().toISOString(),
  payload: {
    toolName: 'Bash',
    ...payload,
  },
});

describe('Permission Handler', () => {
  describe('createPermissionHandler', () => {
    describe('Policy evaluation', () => {
      it('should return allow when policy allows the tool', async () => {
        const policy: PermissionPolicy = {
          name: 'test-policy',
          tools: { allowed: ['Read'] },
          defaultAction: 'deny',
        };

        const handler = createPermissionHandler({ policy });
        const result = await handler(createMockEvent({ toolName: 'Read' }));

        expect(result.action).toBe('allow');
        expect(result.message).toContain('Auto-approved');
        expect(result.message).toContain('test-policy');
      });

      it('should return deny when policy denies the tool', async () => {
        const policy: PermissionPolicy = {
          name: 'test-policy',
          tools: { denied: ['Bash'] },
          defaultAction: 'allow',
        };

        const handler = createPermissionHandler({ policy });
        const result = await handler(createMockEvent({ toolName: 'Bash' }));

        expect(result.action).toBe('deny');
        expect(result.message).toContain('Auto-denied');
        expect(result.message).toContain('test-policy');
      });

      it('should return ask when policy returns ask and no callback', async () => {
        const policy: PermissionPolicy = {
          defaultAction: 'ask',
        };

        const handler = createPermissionHandler({ policy });
        const result = await handler(createMockEvent({ toolName: 'CustomTool' }));

        expect(result.action).toBe('ask');
        expect(result.message).toContain('no callback provided');
      });

      it('should handle unnamed policies gracefully', async () => {
        const policy: PermissionPolicy = {
          tools: { allowed: ['Read'] },
        };

        const handler = createPermissionHandler({ policy });
        const result = await handler(createMockEvent({ toolName: 'Read' }));

        expect(result.action).toBe('allow');
        expect(result.message).toContain('unnamed');
      });
    });

    describe('onAsk callback', () => {
      it('should call onAsk when policy returns ask', async () => {
        const onAsk = vi.fn().mockResolvedValue(true);
        const policy: PermissionPolicy = { defaultAction: 'ask' };

        const handler = createPermissionHandler({ policy, onAsk });
        await handler(createMockEvent({ toolName: 'CustomTool' }));

        expect(onAsk).toHaveBeenCalledTimes(1);
        expect(onAsk).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'CustomTool' }));
      });

      it('should return allow when onAsk returns true', async () => {
        const onAsk = vi.fn().mockResolvedValue(true);
        const policy: PermissionPolicy = { defaultAction: 'ask' };

        const handler = createPermissionHandler({ policy, onAsk });
        const result = await handler(createMockEvent());

        expect(result.action).toBe('allow');
        expect(result.message).toContain('User approved');
      });

      it('should return deny when onAsk returns false', async () => {
        const onAsk = vi.fn().mockResolvedValue(false);
        const policy: PermissionPolicy = { defaultAction: 'ask' };

        const handler = createPermissionHandler({ policy, onAsk });
        const result = await handler(createMockEvent());

        expect(result.action).toBe('deny');
        expect(result.message).toContain('User denied');
      });

      it('should timeout and use timeoutAction after askTimeout', async () => {
        const onAsk = vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
        );
        const policy: PermissionPolicy = { defaultAction: 'ask' };

        const handler = createPermissionHandler({
          policy,
          onAsk,
          askTimeout: 50,
          timeoutAction: 'deny',
        });
        const result = await handler(createMockEvent());

        expect(result.action).toBe('deny');
        expect(result.message).toContain('timed out');
        expect(result.message).toContain('50ms');
      });

      it('should use allow as timeoutAction when specified', async () => {
        const onAsk = vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(false), 100))
        );
        const policy: PermissionPolicy = { defaultAction: 'ask' };

        const handler = createPermissionHandler({
          policy,
          onAsk,
          askTimeout: 50,
          timeoutAction: 'allow',
        });
        const result = await handler(createMockEvent());

        expect(result.action).toBe('allow');
      });

      it('should handle onAsk errors gracefully', async () => {
        const onAsk = vi.fn().mockRejectedValue(new Error('Connection failed'));
        const policy: PermissionPolicy = { defaultAction: 'ask' };

        const handler = createPermissionHandler({
          policy,
          onAsk,
          timeoutAction: 'deny',
        });
        const result = await handler(createMockEvent());

        expect(result.action).toBe('deny');
        expect(result.message).toContain('Error during ask');
      });
    });

    describe('onDecision callback', () => {
      it('should call onDecision for allow decisions', async () => {
        const onDecision = vi.fn();
        const policy: PermissionPolicy = { tools: { allowed: ['Read'] } };

        const handler = createPermissionHandler({ policy, onDecision });
        await handler(createMockEvent({ toolName: 'Read' }));

        expect(onDecision).toHaveBeenCalledWith(
          expect.objectContaining({ toolName: 'Read' }),
          'allow',
          'policy'
        );
      });

      it('should call onDecision for deny decisions', async () => {
        const onDecision = vi.fn();
        const policy: PermissionPolicy = { tools: { denied: ['Bash'] } };

        const handler = createPermissionHandler({ policy, onDecision });
        await handler(createMockEvent({ toolName: 'Bash' }));

        expect(onDecision).toHaveBeenCalledWith(
          expect.objectContaining({ toolName: 'Bash' }),
          'deny',
          'policy'
        );
      });

      it('should call onDecision with user decidedBy for user decisions', async () => {
        const onDecision = vi.fn();
        const onAsk = vi.fn().mockResolvedValue(true);
        const policy: PermissionPolicy = { defaultAction: 'ask' };

        const handler = createPermissionHandler({ policy, onAsk, onDecision });
        await handler(createMockEvent());

        expect(onDecision).toHaveBeenCalledWith(expect.any(Object), 'allow', 'user');
      });

      it('should call onDecision with default decidedBy when no callback', async () => {
        const onDecision = vi.fn();
        const policy: PermissionPolicy = { defaultAction: 'ask' };

        const handler = createPermissionHandler({ policy, onDecision });
        await handler(createMockEvent());

        expect(onDecision).toHaveBeenCalledWith(expect.any(Object), 'ask', 'default');
      });

      it('should call onDecision with default decidedBy on timeout', async () => {
        const onDecision = vi.fn();
        const onAsk = vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
        );
        const policy: PermissionPolicy = { defaultAction: 'ask' };

        const handler = createPermissionHandler({
          policy,
          onAsk,
          onDecision,
          askTimeout: 10,
          timeoutAction: 'deny',
        });
        await handler(createMockEvent());

        expect(onDecision).toHaveBeenCalledWith(expect.any(Object), 'deny', 'default');
      });
    });

    describe('With preset policies', () => {
      it('should work with permissive preset', async () => {
        const handler = createPermissionHandler({ policy: PERMISSION_PRESETS.permissive });

        const result = await handler(createMockEvent({ toolName: 'AnyTool' }));
        expect(result.action).toBe('allow');
      });

      it('should work with restrictive preset', async () => {
        const handler = createPermissionHandler({ policy: PERMISSION_PRESETS.restrictive });

        const result = await handler(createMockEvent({ toolName: 'AnyTool' }));
        expect(result.action).toBe('deny');
      });

      it('should work with readOnly preset', async () => {
        const handler = createPermissionHandler({ policy: PERMISSION_PRESETS.readOnly });

        const readResult = await handler(createMockEvent({ toolName: 'Read' }));
        expect(readResult.action).toBe('allow');

        const writeResult = await handler(createMockEvent({ toolName: 'Write' }));
        expect(writeResult.action).toBe('deny');
      });
    });
  });

  describe('isSafeCommand', () => {
    it('should return true for git read commands', () => {
      expect(isSafeCommand('git status')).toBe(true);
      expect(isSafeCommand('git diff')).toBe(true);
      expect(isSafeCommand('git log --oneline')).toBe(true);
      expect(isSafeCommand('git branch -a')).toBe(true);
    });

    it('should return true for file listing commands', () => {
      expect(isSafeCommand('ls')).toBe(true);
      expect(isSafeCommand('ls -la')).toBe(true);
      expect(isSafeCommand('cat file.txt')).toBe(true);
      expect(isSafeCommand('head -n 10 file.txt')).toBe(true);
    });

    it('should return true for search commands', () => {
      expect(isSafeCommand('grep pattern file.txt')).toBe(true);
      expect(isSafeCommand('rg pattern')).toBe(true);
      expect(isSafeCommand('find . -name "*.ts"')).toBe(true);
    });

    it('should return true for info commands', () => {
      expect(isSafeCommand('pwd')).toBe(true);
      expect(isSafeCommand('whoami')).toBe(true);
      expect(isSafeCommand('date')).toBe(true);
      expect(isSafeCommand('which node')).toBe(true);
    });

    it('should return false for non-safe commands', () => {
      expect(isSafeCommand('rm file.txt')).toBe(false);
      expect(isSafeCommand('npm install lodash')).toBe(false);
      expect(isSafeCommand('mkdir new-dir')).toBe(false);
    });
  });

  describe('isDangerousCommand', () => {
    it('should return true for rm -rf commands', () => {
      expect(isDangerousCommand('rm -rf /')).toBe(true);
      expect(isDangerousCommand('rm -rf ~')).toBe(true);
      expect(isDangerousCommand('rm -rf /home')).toBe(true);
    });

    it('should return true for sudo commands', () => {
      expect(isDangerousCommand('sudo rm file')).toBe(true);
      expect(isDangerousCommand('sudo apt install')).toBe(true);
    });

    it('should return true for privilege escalation', () => {
      expect(isDangerousCommand('su root')).toBe(true);
      expect(isDangerousCommand('doas command')).toBe(true);
    });

    it('should return true for remote code execution', () => {
      expect(isDangerousCommand('curl https://example.com | bash')).toBe(true);
      expect(isDangerousCommand('wget https://example.com | bash')).toBe(true);
      expect(isDangerousCommand('eval $(cat script)')).toBe(true);
    });

    it('should return true for dangerous git commands', () => {
      expect(isDangerousCommand('git push --force origin main')).toBe(true);
      expect(isDangerousCommand('git reset --hard HEAD')).toBe(true);
    });

    it('should return true for process kill commands', () => {
      expect(isDangerousCommand('kill -9 1234')).toBe(true);
      expect(isDangerousCommand('killall node')).toBe(true);
      expect(isDangerousCommand('pkill python')).toBe(true);
    });

    it('should return false for safe commands', () => {
      expect(isDangerousCommand('git status')).toBe(false);
      expect(isDangerousCommand('ls -la')).toBe(false);
      expect(isDangerousCommand('npm run build')).toBe(false);
    });
  });

  describe('getCommandRiskAssessment', () => {
    describe('Dangerous commands', () => {
      it('should identify rm -rf as dangerous', () => {
        const assessment = getCommandRiskAssessment('rm -rf /tmp');
        expect(assessment.risk).toBe('dangerous');
        expect(assessment.reason).toContain('Recursive delete');
      });

      it('should identify sudo as dangerous', () => {
        const assessment = getCommandRiskAssessment('sudo apt install');
        expect(assessment.risk).toBe('dangerous');
        expect(assessment.reason).toContain('Elevated permissions');
      });

      it('should identify curl|bash as dangerous', () => {
        const assessment = getCommandRiskAssessment('curl https://example.com | bash');
        expect(assessment.risk).toBe('dangerous');
        expect(assessment.reason).toContain('Remote code execution');
      });

      it('should identify git push --force as dangerous', () => {
        const assessment = getCommandRiskAssessment('git push --force origin main');
        expect(assessment.risk).toBe('dangerous');
        expect(assessment.reason).toContain('Force push');
      });

      it('should identify git reset --hard as dangerous', () => {
        const assessment = getCommandRiskAssessment('git reset --hard HEAD~5');
        expect(assessment.risk).toBe('dangerous');
        expect(assessment.reason).toContain('Hard reset');
      });

      it('should identify other dangerous commands generically', () => {
        const assessment = getCommandRiskAssessment('kill -9 1234');
        expect(assessment.risk).toBe('dangerous');
        expect(assessment.reason).toContain('destructive');
      });
    });

    describe('Safe commands', () => {
      it('should identify git read operations as safe', () => {
        const assessment = getCommandRiskAssessment('git status');
        expect(assessment.risk).toBe('safe');
        expect(assessment.reason).toContain('Read-only git');
      });

      it('should identify file listing as safe', () => {
        const assessment = getCommandRiskAssessment('ls -la');
        expect(assessment.risk).toBe('safe');
        expect(assessment.reason).toContain('Read-only file');
      });

      it('should identify info queries as safe', () => {
        const assessment = getCommandRiskAssessment('pwd');
        expect(assessment.risk).toBe('safe');
        expect(assessment.reason).toContain('Information query');
      });

      it('should identify other safe commands generically', () => {
        const assessment = getCommandRiskAssessment('npm list');
        expect(assessment.risk).toBe('safe');
        expect(assessment.reason).toContain('Generally safe');
      });
    });

    describe('Unknown commands', () => {
      it('should return unknown for unrecognized commands', () => {
        const assessment = getCommandRiskAssessment('npm run build');
        expect(assessment.risk).toBe('unknown');
        expect(assessment.reason).toContain('No matching');
      });

      it('should return unknown for custom scripts', () => {
        const assessment = getCommandRiskAssessment('./my-script.sh');
        expect(assessment.risk).toBe('unknown');
      });
    });
  });

  describe('Convenience handlers', () => {
    describe('createAlwaysAllowHandler', () => {
      it('should always return allow action', async () => {
        const handler = createAlwaysAllowHandler();
        const result = await handler(createMockEvent());

        expect(result.action).toBe('allow');
        expect(result.message).toContain('Auto-approved');
        expect(result.message).toContain('always allow');
      });

      it('should allow any tool', async () => {
        const handler = createAlwaysAllowHandler();

        const bashResult = await handler(createMockEvent({ toolName: 'Bash', command: 'rm -rf /' }));
        expect(bashResult.action).toBe('allow');

        const writeResult = await handler(createMockEvent({ toolName: 'Write' }));
        expect(writeResult.action).toBe('allow');
      });
    });

    describe('createAlwaysDenyHandler', () => {
      it('should always return deny action', async () => {
        const handler = createAlwaysDenyHandler();
        const result = await handler(createMockEvent());

        expect(result.action).toBe('deny');
        expect(result.message).toContain('Auto-denied');
        expect(result.message).toContain('always deny');
      });

      it('should deny any tool', async () => {
        const handler = createAlwaysDenyHandler();

        const readResult = await handler(createMockEvent({ toolName: 'Read' }));
        expect(readResult.action).toBe('deny');

        const safeResult = await handler(createMockEvent({ toolName: 'Bash', command: 'ls' }));
        expect(safeResult.action).toBe('deny');
      });
    });

    describe('createAlwaysAskHandler', () => {
      it('should always return ask action', async () => {
        const handler = createAlwaysAskHandler();
        const result = await handler(createMockEvent());

        expect(result.action).toBe('ask');
        expect(result.message).toContain('User confirmation required');
      });

      it('should ask for any tool', async () => {
        const handler = createAlwaysAskHandler();

        const safeResult = await handler(createMockEvent({ toolName: 'Read' }));
        expect(safeResult.action).toBe('ask');

        const dangerousResult = await handler(
          createMockEvent({ toolName: 'Bash', command: 'rm -rf /' })
        );
        expect(dangerousResult.action).toBe('ask');
      });
    });
  });
});
