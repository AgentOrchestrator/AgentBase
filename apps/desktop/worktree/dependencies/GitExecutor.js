"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitExecutor = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
/**
 * Production implementation of IGitExecutor using child_process
 */
class GitExecutor {
    async exec(repoPath, args) {
        const { stdout } = await execFileAsync('git', ['-C', repoPath, ...args]);
        return stdout;
    }
    async isRepository(path) {
        try {
            await execFileAsync('git', ['-C', path, 'rev-parse', '--git-dir']);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.GitExecutor = GitExecutor;
