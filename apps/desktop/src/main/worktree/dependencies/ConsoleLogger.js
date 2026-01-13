"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLogger = void 0;
/**
 * Production implementation of ILogger using console
 */
class ConsoleLogger {
    constructor(prefix) {
        this.prefix = prefix;
    }
    info(message, context) {
        if (context) {
            console.log(`${this.prefix} ${message}`, context);
        }
        else {
            console.log(`${this.prefix} ${message}`);
        }
    }
    warn(message, context) {
        if (context) {
            console.warn(`${this.prefix} ${message}`, context);
        }
        else {
            console.warn(`${this.prefix} ${message}`);
        }
    }
    error(message, context) {
        if (context) {
            console.error(`${this.prefix} ${message}`, context);
        }
        else {
            console.error(`${this.prefix} ${message}`);
        }
    }
}
exports.ConsoleLogger = ConsoleLogger;
