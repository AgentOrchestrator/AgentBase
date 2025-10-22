#!/usr/bin/env tsx

/**
 * Setup script router
 * Routes to interactive or non-interactive setup based on flags
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check if --non-interactive flag is present
const args = process.argv.slice(2);
const isNonInteractive = args.includes('--non-interactive');

// Remove --non-interactive flag and pass remaining args
const filteredArgs = args.filter(arg => arg !== '--non-interactive');

// Choose the appropriate script
const scriptName = isNonInteractive ? 'install-non-interactive.ts' : 'install.tsx';
const scriptPath = path.join(__dirname, scriptName);

// Spawn the appropriate script with remaining arguments
const child = spawn('tsx', [scriptPath, ...filteredArgs], {
	stdio: 'inherit',
	env: process.env,
});

child.on('exit', (code) => {
	process.exit(code || 0);
});

child.on('error', (err) => {
	console.error(`Failed to start setup: ${err.message}`);
	process.exit(1);
});
