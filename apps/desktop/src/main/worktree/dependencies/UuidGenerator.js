"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UuidGenerator = void 0;
const crypto_1 = require("crypto");
/**
 * Production implementation of IIdGenerator using crypto.randomUUID
 */
class UuidGenerator {
    generate() {
        return (0, crypto_1.randomUUID)();
    }
}
exports.UuidGenerator = UuidGenerator;
