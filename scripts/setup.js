#!/usr/bin/env node

/**
 * Package-manager agnostic configure script
 * Works with both npm and pnpm
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the CLI directory
const cliDir = path.join(__dirname, '..', 'apps', 'cli');

// Run the configure script directly with tsx
const child = spawn('npx', ['tsx', 'configure.ts', ...process.argv.slice(2)], {
  cwd: cliDir,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error(`Failed to start configuration: ${err.message}`);
  process.exit(1);
});
