"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionById = sessionById;
exports.sessionByName = sessionByName;
exports.latestSession = latestSession;
/**
 * Helper to create a session identifier by ID
 */
function sessionById(id) {
    return { type: 'id', value: id };
}
/**
 * Helper to create a session identifier by name
 */
function sessionByName(name) {
    return { type: 'name', value: name };
}
/**
 * Helper to get the latest session
 */
function latestSession() {
    return { type: 'latest' };
}
