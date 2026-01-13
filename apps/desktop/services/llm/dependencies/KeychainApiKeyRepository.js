"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeychainApiKeyRepository = void 0;
const keytar_1 = __importDefault(require("keytar"));
const types_1 = require("../types");
/**
 * macOS Keychain implementation for API key storage.
 * Uses `keytar` package for cross-platform secure credential storage.
 *
 * Keychain entries are stored as:
 * - Service: "{appName}-llm-keys"
 * - Account: "{vendor}" (e.g., "openai", "anthropic", "google")
 */
class KeychainApiKeyRepository {
    constructor(appName) {
        this.serviceName = `${appName}-llm-keys`;
    }
    async getApiKey(vendor) {
        try {
            const key = await keytar_1.default.getPassword(this.serviceName, vendor);
            return (0, types_1.ok)(key);
        }
        catch (error) {
            return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.KEYCHAIN_ERROR, `Failed to retrieve API key for ${vendor}`, { vendor }, error instanceof Error ? error : undefined));
        }
    }
    async setApiKey(vendor, apiKey) {
        try {
            await keytar_1.default.setPassword(this.serviceName, vendor, apiKey);
            return (0, types_1.ok)(undefined);
        }
        catch (error) {
            return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.KEYCHAIN_ERROR, `Failed to store API key for ${vendor}`, { vendor }, error instanceof Error ? error : undefined));
        }
    }
    async deleteApiKey(vendor) {
        try {
            await keytar_1.default.deletePassword(this.serviceName, vendor);
            return (0, types_1.ok)(undefined);
        }
        catch (error) {
            return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.KEYCHAIN_ERROR, `Failed to delete API key for ${vendor}`, { vendor }, error instanceof Error ? error : undefined));
        }
    }
    async hasApiKey(vendor) {
        const result = await this.getApiKey(vendor);
        return result.success && result.data !== null;
    }
    async listStoredVendors() {
        try {
            const credentials = await keytar_1.default.findCredentials(this.serviceName);
            const vendors = credentials.map((c) => c.account);
            return (0, types_1.ok)(vendors);
        }
        catch (error) {
            return (0, types_1.err)((0, types_1.llmError)(types_1.LLMErrorCode.KEYCHAIN_ERROR, 'Failed to list stored vendors', undefined, error instanceof Error ? error : undefined));
        }
    }
}
exports.KeychainApiKeyRepository = KeychainApiKeyRepository;
