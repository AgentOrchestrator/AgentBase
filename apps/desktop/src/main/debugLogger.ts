// debugLogger.ts - TEMPORARY DEBUG FILE for terminal hooks issue

import fs from 'node:fs';
import { ipcMain } from 'electron';

const DEBUG_LOG = '/tmp/debug-terminal-hooks.log';

// Unique session ID for this debugging session
const SESSION_ID = 'DBG-h00ks1';

let stepCounter = 0;

export function debugStep(file: string, location: string, state: Record<string, unknown>) {
  stepCounter++;
  const line = `[${SESSION_ID}] Step ${stepCounter} | ${file}:${location} | ${JSON.stringify(state)}`;
  try {
    fs.appendFileSync(DEBUG_LOG, `${line}\n`);
  } catch {
    // Ignore write errors
  }
}

export function debugInit() {
  stepCounter = 0;
  const line = `[${SESSION_ID}] === Debug session started at ${new Date().toISOString()} ===`;
  try {
    fs.appendFileSync(DEBUG_LOG, `${line}\n`);
  } catch {
    // Ignore write errors
  }
}

export function debugMark(label: string) {
  const line = `[${SESSION_ID}] ═══ ${label} ═══`;
  try {
    fs.appendFileSync(DEBUG_LOG, `${line}\n`);
  } catch {
    // Ignore write errors
  }
}

// IPC handler for renderer process to write debug logs
export function setupRendererDebugIpc() {
  ipcMain.on('debug-log', (_event, line: string) => {
    try {
      fs.appendFileSync(DEBUG_LOG, `${line}\n`);
    } catch {
      // Ignore write errors
    }
  });
}

// Debug logger for renderer (to be called via IPC)
export const RENDERER_SESSION_ID = SESSION_ID;
export const RENDERER_DEBUG_LOG = DEBUG_LOG;
