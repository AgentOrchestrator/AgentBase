#!/usr/bin/env tsx

import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

interface InstallOptions {
	useLocal?: boolean; // true = local supabase, false = remote
	supabaseUrl?: string;
	supabaseAnonKey?: string;
	openaiApiKey?: string;
	skipOpenai?: boolean; // Skip OpenAI setup entirely
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

	try {
		// Step 0: Check Supabase CLI (if using local)
		log('Checking Supabase CLI...', 'running');
		let useLocalSupabase = options.useLocal ?? true; // Default to local
		let supabaseUrl = options.supabaseUrl || '';
		let supabaseAnonKey = options.supabaseAnonKey || '';

		if (useLocalSupabase) {
			try {
				const { stdout } = await execAsync('supabase --version');
				log(`Supabase CLI found: ${stdout.trim()}`, 'success');
			} catch {
				log('Supabase CLI not found, attempting to install...', 'running');
				try {
					const isMac = process.platform === 'darwin';
					if (isMac) {
						// Try common Homebrew paths
						const brewPaths = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'];
						let brewPath = '';

						for (const brewPathCandidate of brewPaths) {
							try {
								await execAsync(`${brewPathCandidate} --version`, {
									env: {
										...process.env,
										PATH: '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
									}
								});
								brewPath = brewPathCandidate;
								break;
							} catch {
								continue;
							}
						}

						if (!brewPath) {
							log('Installing Supabase CLI via curl...', 'running');
							await execAsync('curl -fsSL https://supabase.com/install.sh | sh', {
								env: {
									...process.env,
									PATH: '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
								}
							});
							log('Installed via curl', 'success');
						} else {
							await execAsync(`${brewPath} install supabase/tap/supabase`, {
								env: {
									...process.env,
									PATH: '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
								}
							});
							log('Installed via Homebrew', 'success');
						}
					} else if (process.platform === 'linux') {
						await execAsync('curl -fsSL https://supabase.com/install.sh | sh');
						log('Installed via curl', 'success');
					} else {
						throw new Error('Unsupported OS. Please install Supabase CLI manually.');
					}
				} catch (error) {
					throw new Error(`Failed to install Supabase CLI: ${error instanceof Error ? error.message : 'Unknown error'}`);
				}
			}

			// Step 1: Start Supabase
			log('Starting Supabase...', 'running');
			try {
				await execAsync('supabase status');
				log('Supabase already running', 'success');
			} catch {
				log('Starting Supabase (this may take a minute)...', 'running');
				await execAsync('supabase start', { maxBuffer: 1024 * 1024 * 10 });
				log('Started successfully', 'success');
			}

			// Step 2: Extract Supabase credentials
			log('Extracting Supabase credentials...', 'running');
			const { stdout: envOutput } = await execAsync('supabase status -o env');

			// Match both old format (SUPABASE_URL=...) and new format (API_URL="...")
			const urlMatch = envOutput.match(/API_URL="?([^"\n]+)"?/) || envOutput.match(/SUPABASE_URL="?([^"\n]+)"?/);
			const anonMatch = envOutput.match(/ANON_KEY="?([^"\n]+)"?/) || envOutput.match(/SUPABASE_ANON_KEY="?([^"\n]+)"?/);

			if (!urlMatch || !anonMatch) {
				throw new Error('Failed to extract Supabase credentials');
			}

			supabaseUrl = urlMatch[1].trim();
			supabaseAnonKey = anonMatch[1].trim();
			log('Credentials extracted', 'success');
		} else {
			log('Using remote Supabase (skipped local installation)', 'success');
			if (!supabaseUrl || !supabaseAnonKey) {
				throw new Error('Remote Supabase credentials (supabaseUrl and supabaseAnonKey) are required when useLocal=false');
			}
		}

		// Step 3: Get OpenAI key
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

		// Step 4: Create/update .env files
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

		// Step 5: Install dependencies (skip if already in postinstall)
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

		// Completion message
		console.log('\n✨ Installation Complete!\n');
		console.log('Next steps:');
		console.log('  1. Run pnpm dev to start all services');
		console.log('     Or use pnpm dev:daemon and pnpm dev:web separately');
		console.log('  2. Access the web app at http://localhost:3000\n');
		console.log('To stop services: Press Ctrl+C');
		if (useLocalSupabase) {
			console.log('To stop Supabase later: supabase stop\n');
		}

		process.exit(0);
	} catch (error) {
		log(`Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
		process.exit(1);
	}
}

// Parse command-line arguments and environment variables
const args = process.argv.slice(2);
const options: InstallOptions = {};

// First, check environment variables for secrets (more secure than CLI args)
// This allows using: SUPABASE_URL=xxx OPENAI_API_KEY=yyy tsx install-non-interactive.ts
if (process.env.SUPABASE_URL) {
	options.supabaseUrl = process.env.SUPABASE_URL;
}
if (process.env.SUPABASE_ANON_KEY) {
	options.supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
}
if (process.env.OPENAI_API_KEY) {
	options.openaiApiKey = process.env.OPENAI_API_KEY;
}

for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	switch (arg) {
		case '--local':
			options.useLocal = true;
			break;
		case '--remote':
			options.useLocal = false;
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
Agent Orchestrator Non-Interactive Installation

Usage: tsx install-non-interactive.ts [options]

Options:
  --local                     Use local Supabase (default)
  --remote                    Use remote Supabase
  --supabase-url <url>        Supabase URL (required for remote)
  --supabase-anon-key <key>   Supabase anon key (required for remote)
  --openai-key <key>          OpenAI API key (optional)
  --skip-openai               Skip OpenAI configuration
  --help, -h                  Show this help message

Environment Variables (preferred for secrets):
  SUPABASE_URL                Supabase URL (overridden by --supabase-url)
  SUPABASE_ANON_KEY           Supabase anon key (overridden by --supabase-anon-key)
  OPENAI_API_KEY              OpenAI API key (overridden by --openai-key)

Examples:
  # Local Supabase with OpenAI (using env vars - RECOMMENDED)
  OPENAI_API_KEY=sk-xxx tsx install-non-interactive.ts --local

  # Local Supabase without OpenAI (development mode)
  tsx install-non-interactive.ts --local --skip-openai

  # Remote Supabase (using env vars - RECOMMENDED)
  SUPABASE_URL=https://xxx.supabase.co \\
  SUPABASE_ANON_KEY=eyJh... \\
  OPENAI_API_KEY=sk-xxx \\
  tsx install-non-interactive.ts --remote

  # Remote Supabase (using CLI args - less secure, visible in process list)
  tsx install-non-interactive.ts --remote \\
    --supabase-url https://xxx.supabase.co \\
    --supabase-anon-key eyJh... \\
    --openai-key sk-xxx

  # CI/CD usage (read from .env file)
  export $(cat .env | xargs) && tsx install-non-interactive.ts --local
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
