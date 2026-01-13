"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeAgent = void 0;
const child_process_1 = require("child_process");
const BaseCliAgent_1 = require("./BaseCliAgent");
const types_1 = require("../types");
/**
 * Claude Code CLI agent implementation
 *
 * Implements:
 * - ICodingAgentProvider: Core generation via `claude -p`
 * - ISessionResumable: Resume via `--resume` and `--continue`
 * - ISessionForkable: Fork via `--fork-session`
 * - IProcessLifecycle: Lifecycle management (inherited from BaseCliAgent)
 *
 * Does NOT implement ISessionManager since Claude Code CLI
 * doesn't expose session listing commands (CLI-only approach).
 *
 * CLI Commands Used:
 * - `claude -p "prompt"` - One-off generation
 * - `claude --resume <id> -p "prompt"` - Resume by ID/name
 * - `claude --continue -p "prompt"` - Resume latest session
 * - `claude --fork-session --session-id <parent>` - Fork session
 * - `claude --version` - Verify availability
 */
class ClaudeCodeAgent extends BaseCliAgent_1.BaseCliAgent {
    get agentType() {
        return 'claude_code';
    }
    getCapabilities() {
        return {
            canGenerate: true,
            canResumeSession: true,
            canForkSession: true,
            canListSessions: false, // CLI doesn't expose listing
            supportsStreaming: true,
        };
    }
    getExecutablePath() {
        return this.config.executablePath ?? ClaudeCodeAgent.DEFAULT_EXECUTABLE;
    }
    async verifyExecutable() {
        return new Promise((resolve) => {
            const proc = (0, child_process_1.spawn)(this.getExecutablePath(), ['--version'], {
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 5000,
            });
            proc.on('close', (code) => {
                resolve(code === 0);
            });
            proc.on('error', () => {
                resolve(false);
            });
        });
    }
    parseOutput(output) {
        // Claude Code in print mode outputs directly to stdout
        // The output is the assistant's response text
        return {
            content: output.trim(),
            messageId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
        };
    }
    // ============================================
    // ICodingAgentProvider Implementation
    // ============================================
    async generate(request) {
        const initCheck = this.ensureInitialized();
        if (initCheck.success === false) {
            return { success: false, error: initCheck.error };
        }
        const args = this.buildGenerateArgs(request);
        const spawnResult = this.spawnProcess(args, {
            workingDirectory: request.workingDirectory,
            timeout: request.timeout,
        });
        if (spawnResult.success === false) {
            return { success: false, error: spawnResult.error };
        }
        return this.collectOutput(spawnResult.data, request.timeout);
    }
    async generateStreaming(request, onChunk) {
        const initCheck = this.ensureInitialized();
        if (initCheck.success === false) {
            return { success: false, error: initCheck.error };
        }
        const args = this.buildGenerateArgs(request);
        const spawnResult = this.spawnProcess(args, {
            workingDirectory: request.workingDirectory,
            timeout: request.timeout,
        });
        if (spawnResult.success === false) {
            return { success: false, error: spawnResult.error };
        }
        return this.streamOutput(spawnResult.data, onChunk, request.timeout);
    }
    buildGenerateArgs(request) {
        const args = ['-p', request.prompt];
        if (request.systemPrompt) {
            args.push('--append-system-prompt', request.systemPrompt);
        }
        return args;
    }
    // ============================================
    // ISessionResumable Implementation
    // ============================================
    async continueSession(identifier, prompt, options) {
        const initCheck = this.ensureInitialized();
        if (initCheck.success === false) {
            return { success: false, error: initCheck.error };
        }
        const args = this.buildContinueArgs(identifier, prompt);
        const spawnResult = this.spawnProcess(args, {
            workingDirectory: options?.workingDirectory,
            timeout: options?.timeout,
        });
        if (spawnResult.success === false) {
            return { success: false, error: spawnResult.error };
        }
        return this.collectOutput(spawnResult.data, options?.timeout);
    }
    async continueSessionStreaming(identifier, prompt, onChunk, options) {
        const initCheck = this.ensureInitialized();
        if (initCheck.success === false) {
            return { success: false, error: initCheck.error };
        }
        const args = this.buildContinueArgs(identifier, prompt);
        const spawnResult = this.spawnProcess(args, {
            workingDirectory: options?.workingDirectory,
            timeout: options?.timeout,
        });
        if (spawnResult.success === false) {
            return { success: false, error: spawnResult.error };
        }
        return this.streamOutput(spawnResult.data, onChunk, options?.timeout);
    }
    buildContinueArgs(identifier, prompt) {
        const args = [];
        switch (identifier.type) {
            case 'latest':
                args.push('--continue');
                break;
            case 'id':
            case 'name':
                args.push('--resume', identifier.value);
                break;
        }
        args.push('-p', prompt);
        return args;
    }
    // ============================================
    // ISessionForkable Implementation
    // ============================================
    async forkSession(parentIdentifier, options) {
        const initCheck = this.ensureInitialized();
        if (initCheck.success === false) {
            return { success: false, error: initCheck.error };
        }
        // Resolve the parent session ID
        const parentId = this.resolveSessionId(parentIdentifier);
        if (!parentId) {
            return (0, types_1.err)((0, types_1.agentError)(types_1.AgentErrorCode.SESSION_INVALID, 'Cannot fork from "latest" session - please specify a session ID or name'));
        }
        const args = ['--fork-session', '--resume', parentId];
        if (options?.customSessionId) {
            args.push('--session-id', options.customSessionId);
        }
        // Add a minimal prompt to trigger the fork
        args.push('-p', '');
        const spawnResult = this.spawnProcess(args);
        if (spawnResult.success === false) {
            return { success: false, error: spawnResult.error };
        }
        // Wait for the process to complete
        const result = await this.collectOutput(spawnResult.data);
        if (result.success === false) {
            return { success: false, error: result.error };
        }
        // Return the new session info
        // Note: The actual session ID is generated by Claude Code internally
        // We return what we know about the new session
        const newSessionId = options?.customSessionId ?? crypto.randomUUID();
        const now = new Date().toISOString();
        return (0, types_1.ok)({
            id: newSessionId,
            name: options?.newSessionName,
            agentType: 'claude_code',
            createdAt: now,
            updatedAt: now,
            messageCount: 0, // Unknown without DB access
            parentSessionId: parentId,
        });
    }
    resolveSessionId(identifier) {
        switch (identifier.type) {
            case 'id':
            case 'name':
                return identifier.value;
            case 'latest':
                return null; // Cannot resolve latest without DB access
        }
    }
}
exports.ClaudeCodeAgent = ClaudeCodeAgent;
ClaudeCodeAgent.DEFAULT_EXECUTABLE = 'claude';
