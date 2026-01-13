"use strict";
/**
 * Factory for creating database instances
 * Implements singleton pattern to ensure only one database instance exists
 */
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
exports.DatabaseFactory = void 0;
const path = __importStar(require("path"));
const electron_1 = require("electron");
const SQLiteDatabase_1 = require("./SQLiteDatabase");
class DatabaseFactory {
    /**
     * Get the singleton database instance
     * @param type - The type of database to create (defaults to 'sqlite')
     * @param customPath - Optional custom path for the database file
     * @returns The database instance
     */
    static async getDatabase(type = 'sqlite', customPath) {
        if (this.instance) {
            return this.instance;
        }
        const dbPath = customPath || this.getDefaultDatabasePath();
        switch (type) {
            case 'sqlite':
                this.instance = new SQLiteDatabase_1.SQLiteDatabase(dbPath);
                break;
            default:
                throw new Error(`Unsupported database type: ${type}`);
        }
        // Initialize the database (create tables, etc.)
        await this.instance.initialize();
        return this.instance;
    }
    /**
     * Get the default database file path
     * Stores in the user's app data directory
     */
    static getDefaultDatabasePath() {
        const userDataPath = electron_1.app.getPath('userData');
        return path.join(userDataPath, 'canvas-state.db');
    }
    /**
     * Close the database connection
     * Resets the singleton instance
     */
    static closeDatabase() {
        if (this.instance) {
            this.instance.close();
            this.instance = null;
        }
    }
    /**
     * Reset the singleton instance (useful for testing)
     */
    static reset() {
        this.closeDatabase();
    }
}
exports.DatabaseFactory = DatabaseFactory;
DatabaseFactory.instance = null;
