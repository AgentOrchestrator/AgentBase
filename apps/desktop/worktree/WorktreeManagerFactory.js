"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorktreeManagerFactory = void 0;
const path = __importStar(require("path"));
const electron_1 = require("electron");
const WorktreeManager_1 = require("./WorktreeManager");
const dependencies_1 = require("./dependencies");
/**
 * Factory for creating and managing the WorktreeManager singleton.
 * Wires up all production dependencies.
 */
class WorktreeManagerFactory {
    /**
     * Configure the factory before use
     * @param config - WorktreeManager configuration
     */
    static configure(config) {
        if (this.instance) {
            throw new Error('Cannot configure after manager has been initialized');
        }
        this.config = config;
    }
    /**
     * Get the singleton WorktreeManager instance.
     * Must call configure() before first call to getManager().
     */
    static async getManager() {
        if (this.instance) {
            return this.instance;
        }
        if (!this.config) {
            throw new Error('WorktreeManagerFactory not configured. Call configure() first.');
        }
        const dbPath = path.join(electron_1.app.getPath('userData'), 'worktrees.db');
        const store = new dependencies_1.WorktreeStore(dbPath);
        const git = new dependencies_1.GitExecutor();
        const fs = new dependencies_1.Filesystem();
        const idGenerator = new dependencies_1.UuidGenerator();
        const logger = new dependencies_1.ConsoleLogger('[WorktreeManager]');
        this.instance = new WorktreeManager_1.WorktreeManager(this.config, store, git, fs, idGenerator, logger);
        await this.instance.initialize();
        return this.instance;
    }
    /**
     * Close the manager and reset singleton
     */
    static closeManager() {
        if (this.instance) {
            this.instance.close();
            this.instance = null;
        }
    }
    /**
     * Reset factory state (for testing)
     */
    static reset() {
        this.closeManager();
        this.config = null;
    }
}
exports.WorktreeManagerFactory = WorktreeManagerFactory;
WorktreeManagerFactory.instance = null;
WorktreeManagerFactory.config = null;
