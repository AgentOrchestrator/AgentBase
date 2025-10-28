#!/usr/bin/env tsx

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

interface InstallOptions {
	supabaseUrl?: string;
	supabaseAnonKey?: string;
	openaiApiKey?: string;
	skipOpenai?: boolean; // Skip OpenAI setup entirely
	envFile?: string; // Path to custom env file
}

async function log(message: string, level: 'info' | 'success' | 'error' | 'running' = 'info') {
	const prefix = {
		info: '  ',
		success: '✓ ',
		error: '✗ ',
		running: '⋯ '
	}[level];
	console.log(`${prefix}${message}`);
}

async function mergeEnvFile(filePath: string, newEntries: Record<string, string>) {
	const existingVars: Record<string, string> = {};
	let comments: string[] = [];

	// Read existing file if it exists
	if (fs.existsSync(filePath)) {
		const existingContent = fs.readFileSync(filePath, 'utf-8');
		const lines = existingContent.split('\n');

		// Extract comments from top and existing variables
		for (const line of lines) {
			if (line.startsWith('#') || line.trim() === '') {
				if (Object.keys(existingVars).length === 0) {
					comments.push(line);
				}
			} else {
				const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
				if (match) {
					existingVars[match[1]] = match[2];
				}
			}
		}
	}

	// Merge: existing values take precedence over new ones
	const mergedVars = { ...newEntries, ...existingVars };

	// Build new content
	let newContent = comments.length > 0 ? comments.join('\n') + '\n' : '';

	Object.entries(mergedVars).forEach(([key, value]) => {
		newContent += `${key}=${value}\n`;
	});

	fs.writeFileSync(filePath, newContent);
}

async function install(options: InstallOptions = {}) {
	console.log('\n🚀 Agent Orchestrator Installation (Non-Interactive Mode)\n');

	// Show env file usage if specified
	if (options.envFile) {
		log(`Loading environment variables from: ${options.envFile}`, 'info');
	}

	try {
		// Step 1: Validate Supabase credentials
		log('Validating Supabase credentials...', 'running');
		const supabaseUrl = options.supabaseUrl || '';
		const supabaseAnonKey = options.supabaseAnonKey || '';

		if (!supabaseUrl || !supabaseAnonKey) {
			throw new Error(`
Supabase credentials are required.

Setup instructions:

For LOCAL Supabase:
1. Install Supabase CLI:
   macOS:  brew install supabase/tap/supabase
   Linux:  curl -fsSL https://supabase.com/install.sh | sh

2. Start Supabase: supabase start

3. Get credentials: supabase status
   Then run setup with:
   SUPABASE_URL=<url> SUPABASE_ANON_KEY=<key> pnpm run setup --non-interactive

For REMOTE Supabase:
1. Create project at https://supabase.com
2. Get credentials from Project Settings → API
3. Run setup with:
   SUPABASE_URL=<url> SUPABASE_ANON_KEY=<key> pnpm run setup --non-interactive
			`);
		}

		log(`Using Supabase URL: ${supabaseUrl}`, 'success');

		// Step 2: Get OpenAI key
		log('Configuring OpenAI API Key...', 'running');
		let openaiKey = options.openaiApiKey || '';

		// Check if already exists
		const daemonEnvPath = path.join(process.cwd(), '..', '..', 'apps', 'daemon', '.env');
		let existingKey = '';
		if (fs.existsSync(daemonEnvPath)) {
			const existingEnv = fs.readFileSync(daemonEnvPath, 'utf-8');
			const keyMatch = existingEnv.match(/OPENAI_API_KEY=(.+)/);
			if (keyMatch && keyMatch[1] !== 'sk-your_openai_api_key_here' && keyMatch[1] !== '') {
				existingKey = keyMatch[1].trim();
			}
		}

		if (existingKey) {
			openaiKey = existingKey;
			log('Using existing OpenAI key', 'success');
		} else if (options.skipOpenai) {
			log('Skipping OpenAI configuration (will use development mode)', 'success');
		} else if (!openaiKey) {
			log('No OpenAI key provided, will use development mode', 'success');
		} else {
			log('Using provided OpenAI key', 'success');
		}

		// Step 3: Create/update .env files
		log('Creating .env files...', 'running');

		// Root .env
		const rootEnvPath = path.join(process.cwd(), '..', '..', '.env');
		if (!fs.existsSync(rootEnvPath)) {
			const header = `# Supabase Configuration
# DO NOT use these in production!

`;
			fs.writeFileSync(rootEnvPath, header);
		}
		mergeEnvFile(rootEnvPath, {
			SUPABASE_URL: supabaseUrl,
			SUPABASE_ANON_KEY: supabaseAnonKey,
		});

		// Daemon .env
		if (!fs.existsSync(daemonEnvPath)) {
			const header = `# Supabase Configuration
# OpenAI Configuration (for AI summaries)
# Claude Code Home Directory (optional)

`;
			fs.writeFileSync(daemonEnvPath, header);
		}
		mergeEnvFile(daemonEnvPath, {
			SUPABASE_URL: supabaseUrl,
			SUPABASE_ANON_KEY: supabaseAnonKey,
			OPENAI_API_KEY: openaiKey,
			DEVELOPMENT: openaiKey ? 'false' : 'true',
			CLAUDE_CODE_HOME: '',
			PERIODIC_SYNC_INTERVAL_MS: '600000',
			SESSION_LOOKBACK_DAYS: '30',
		});

		// Web .env.local (client-side)
		const webEnvLocalPath = path.join(process.cwd(), '..', '..', 'apps', 'web', '.env.local');
		mergeEnvFile(webEnvLocalPath, {
			NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
			NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
		});

		log('Environment files created', 'success');

		// Step 4: Install dependencies (skip if already in postinstall)
		if (process.env.npm_lifecycle_event !== 'install') {
			log('Installing monorepo dependencies with pnpm...', 'running');
			const rootPath = path.join(process.cwd(), '..', '..');
			await execAsync('pnpm install', {
				cwd: rootPath,
				maxBuffer: 1024 * 1024 * 10,
			});
			log('Dependencies installed', 'success');
		} else {
			log('Skipping dependency installation (already running as part of pnpm install)', 'info');
		}

		// Step 5: Install Python dependencies for memory service
		log('Setting up memory service (Python)...', 'running');
		const memoryServicePath = path.join(process.cwd(), '..', '..', 'apps', 'memory-service');
		try {
			// Check if Python 3 is available
			await execAsync('python3 --version');

			// Create virtual environment if it doesn't exist
			const venvPath = path.join(memoryServicePath, 'venv');
			if (!fs.existsSync(venvPath)) {
				log('Creating Python virtual environment...', 'running');
				await execAsync('python3 -m venv venv', {
					cwd: memoryServicePath,
				});
				log('Virtual environment created', 'success');
			}

			// Install dependencies in venv
			log('Installing Python dependencies in venv...', 'running');
			const pipInstallCmd = process.platform === 'win32'
				? 'venv\\Scripts\\pip install -r requirements.txt'
				: 'venv/bin/pip install -r requirements.txt';

			await execAsync(pipInstallCmd, {
				cwd: memoryServicePath,
				maxBuffer: 1024 * 1024 * 10,
			});
			log('Python dependencies installed', 'success');

			// Create .env file for memory service
			const memoryEnvPath = path.join(memoryServicePath, '.env');
			if (!fs.existsSync(memoryEnvPath)) {
				const memoryEnvContent = `# Memory Service Configuration
# Supabase
SUPABASE_URL=${supabaseUrl}
SUPABASE_SERVICE_ROLE_KEY=  # TODO: Add your service role key from supabase status
SUPABASE_ANON_KEY=${supabaseAnonKey}

# Anthropic API (for Claude)
ANTHROPIC_API_KEY=  # TODO: Add your Anthropic API key

# Mem0 Configuration
MEM0_MODE=self-hosted
# MEM0_API_KEY=  # Only needed if using Mem0 Platform

# Service Configuration
SERVICE_PORT=8000
SERVICE_HOST=0.0.0.0
LOG_LEVEL=INFO
`;
				fs.writeFileSync(memoryEnvPath, memoryEnvContent);
				log('Memory service .env file created', 'success');
			}
		} catch (error) {
			log('Python 3 not found - memory service will be skipped', 'info');
			log('To enable memory service later: Install Python 3.11+ and run:', 'info');
			log('  cd apps/memory-service && python3 -m venv venv && venv/bin/pip install -r requirements.txt', 'info');
		}

		// Completion message
		console.log('\n✨ Installation Complete!\n');
		console.log('Next steps:');
		console.log('  1. Run pnpm run dev to start all services');
		console.log('     Or use pnpm run dev:daemon and pnpm run dev:web separately');
		console.log('  2. Access the web app at http://localhost:3000\n');
		console.log('To stop services: Press Ctrl+C');

		process.exit(0);
	} catch (error) {
		log(`Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
		process.exit(1);
	}
}

// Helper function to load env file
function loadEnvFile(filePath: string): Record<string, string> {
	const envVars: Record<string, string> = {};

	// Try the path as-is first, then try relative to root
	let resolvedPath = filePath;
	if (!fs.existsSync(resolvedPath)) {
		// Try relative to monorepo root (../../ from apps/cli/)
		const rootPath = path.join(process.cwd(), '..', '..', filePath);
		if (fs.existsSync(rootPath)) {
			resolvedPath = rootPath;
		} else {
			throw new Error(`Env file not found: ${filePath} (tried ${resolvedPath} and ${rootPath})`);
		}
	}

	const content = fs.readFileSync(resolvedPath, 'utf-8');
	const lines = content.split('\n');

	for (const line of lines) {
		const trimmed = line.trim();
		// Skip comments and empty lines
		if (trimmed.startsWith('#') || trimmed === '') {
			continue;
		}

		const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
		if (match) {
			const key = match[1];
			let value = match[2];

			// Remove surrounding quotes if present
			if ((value.startsWith('"') && value.endsWith('"')) ||
			    (value.startsWith("'") && value.endsWith("'"))) {
				value = value.slice(1, -1);
			}

			envVars[key] = value;
		}
	}

	return envVars;
}

// Parse command-line arguments and environment variables
const args = process.argv.slice(2);
const options: InstallOptions = {};

// Check for --env-file option first
let envFileVars: Record<string, string> = {};
for (let i = 0; i < args.length; i++) {
	if (args[i] === '-e' || args[i] === '--env-file') {
		const envFilePath = args[i + 1];
		if (!envFilePath) {
			console.error('Error: --env-file requires a path argument');
			process.exit(1);
		}
		try {
			envFileVars = loadEnvFile(envFilePath);
			options.envFile = envFilePath;
		} catch (error) {
			console.error(`Error loading env file: ${error instanceof Error ? error.message : 'Unknown error'}`);
			process.exit(1);
		}
		break;
	}
}

// First, check environment variables for secrets (more secure than CLI args)
// Priority: CLI args > process.env > env file
// This allows using: SUPABASE_URL=xxx OPENAI_API_KEY=yyy tsx install-non-interactive.ts
if (envFileVars.SUPABASE_URL || process.env.SUPABASE_URL) {
	options.supabaseUrl = process.env.SUPABASE_URL || envFileVars.SUPABASE_URL;
}
if (envFileVars.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY) {
	options.supabaseAnonKey = process.env.SUPABASE_ANON_KEY || envFileVars.SUPABASE_ANON_KEY;
}
if (envFileVars.OPENAI_API_KEY || process.env.OPENAI_API_KEY) {
	options.openaiApiKey = process.env.OPENAI_API_KEY || envFileVars.OPENAI_API_KEY;
}

for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	switch (arg) {
		case '-e':
		case '--env-file':
			// Already processed above, skip the path argument
			i++;
			break;
		case '--supabase-url':
			options.supabaseUrl = args[++i];
			break;
		case '--supabase-anon-key':
			options.supabaseAnonKey = args[++i];
			break;
		case '--openai-key':
			options.openaiApiKey = args[++i];
			break;
		case '--skip-openai':
			options.skipOpenai = true;
			break;
		case '--help':
		case '-h':
			console.log(`
Agent Orchestrator Non-Interactive Setup

Usage: npm run setup -- --non-interactive [options]
   or: pnpm run setup --non-interactive [options]

Required: Supabase credentials (via env vars, env file, or CLI args)

Options:
  -e, --env-file <path>       Load environment variables from file
  --supabase-url <url>        Supabase URL (required)
  --supabase-anon-key <key>   Supabase anon key (required)
  --openai-key <key>          OpenAI API key (optional)
  --skip-openai               Skip OpenAI configuration
  --help, -h                  Show this help message

Environment Variables (preferred for secrets):
  SUPABASE_URL                Supabase URL
  SUPABASE_ANON_KEY           Supabase anon key
  OPENAI_API_KEY              OpenAI API key (optional)

Priority Order (highest to lowest):
  1. CLI arguments (--supabase-url, --openai-key, etc.)
  2. Environment variables (SUPABASE_URL, OPENAI_API_KEY, etc.)
  3. Env file specified with -e/--env-file

Setup Instructions:

  For LOCAL Supabase:
    1. Install CLI:  brew install supabase/tap/supabase  (macOS)
                     curl -fsSL https://supabase.com/install.sh | sh  (Linux)
    2. Start:        supabase start
    3. Get creds:    supabase status

  For REMOTE Supabase:
    1. Create project at https://supabase.com
    2. Get credentials from Project Settings → API

Examples:
  # Using env file (recommended for CI/CD)
  pnpm run setup --non-interactive -e .env.production

  # Using environment variables (recommended)
  SUPABASE_URL=https://xxx.supabase.co \\
  SUPABASE_ANON_KEY=eyJh... \\
  OPENAI_API_KEY=sk-xxx \\
  pnpm run setup --non-interactive

  # Using CLI args (less secure - visible in process list)
  pnpm run setup --non-interactive \\
    --supabase-url https://xxx.supabase.co \\
    --supabase-anon-key eyJh... \\
    --openai-key sk-xxx
`);
			process.exit(0);
		default:
			console.error(`Unknown option: ${arg}`);
			console.error('Use --help to see available options');
			process.exit(1);
	}
}

// Run installation
install(options);
