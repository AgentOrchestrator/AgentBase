"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryApiKeyRepository = void 0;
const types_1 = require("../types");
/**
 * In-memory implementation of API key storage.
 * Useful for testing and as a fallback when Keychain is unavailable.
 *
 * WARNING: Keys stored in memory are not persisted and will be lost on restart.
 */
class InMemoryApiKeyRepository {
    constructor() {
        this.keys = new Map();
    }
    async getApiKey(vendor) {
        const key = this.keys.get(vendor) ?? null;
        return (0, types_1.ok)(key);
    }
    async setApiKey(vendor, apiKey) {
        this.keys.set(vendor, apiKey);
        return (0, types_1.ok)(undefined);
    }
    async deleteApiKey(vendor) {
        this.keys.delete(vendor);
        return (0, types_1.ok)(undefined);
    }
    async hasApiKey(vendor) {
        return this.keys.has(vendor);
    }
    async listStoredVendors() {
        return (0, types_1.ok)(Array.from(this.keys.keys()));
    }
    /**
     * Clear all stored keys (useful for testing)
     */
    clear() {
        this.keys.clear();
    }
}
exports.InMemoryApiKeyRepository = InMemoryApiKeyRepository;
