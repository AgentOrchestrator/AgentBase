#!/usr/bin/env tsx

import React, { useState, useEffect } from 'react';
import { render, Box, Text, Newline } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { useInput } from 'ink';

const execAsync = promisify(exec);

type Step = {
	name: string;
	status: 'pending' | 'running' | 'success' | 'error';
	message?: string;
};

const InstallApp = () => {
	const [currentStep, setCurrentStep] = useState(0);
	const [steps, setSteps] = useState<Step[]>([
		{ name: 'Check Supabase CLI', status: 'pending' },
		{ name: 'Start Supabase', status: 'pending' },
		{ name: 'Extract Supabase credentials', status: 'pending' },
		{ name: 'Configure OpenAI API Key', status: 'pending' },
		{ name: 'Create .env files', status: 'pending' },
		{ name: 'Install dependencies', status: 'pending' },
		{ name: 'Setup Python memory service', status: 'pending' },
	]);
	const [openaiKey, setOpenaiKey] = useState('');
	const [needsOpenaiInput, setNeedsOpenaiInput] = useState(false);
	const [supabaseUrl, setSupabaseUrl] = useState('');
	const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
	const [completed, setCompleted] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [useRemoteSupabase, setUseRemoteSupabase] = useState<boolean | null>(null);
	const [needsSupabaseChoice, setNeedsSupabaseChoice] = useState(false);
	const [needsRemoteCredentials, setNeedsRemoteCredentials] = useState(false);
	const [remoteSupabaseUrl, setRemoteSupabaseUrl] = useState('');
	const [remoteSupabaseAnonKey, setRemoteSupabaseAnonKey] = useState('');
	const [currentCredentialInput, setCurrentCredentialInput] = useState<'url' | 'anon'>('url');
	const [supabaseChoiceInput, setSupabaseChoiceInput] = useState('');

	const updateStep = (index: number, status: Step['status'], message?: string) => {
		setSteps(prev => {
			const newSteps = [...prev];
			newSteps[index] = { ...newSteps[index], status, message };
			return newSteps;
		});
	};

	const runInstall = async () => {
		try {
			// Step 0: Check Supabase CLI and ask user preference
			setCurrentStep(0);
			updateStep(0, 'running');
			try {
				const { stdout } = await execAsync('supabase --version');
				updateStep(0, 'success', `Supabase CLI found: ${stdout.trim()}`);
			} catch {
				updateStep(0, 'success', 'Supabase CLI not found');
			}

			// Always ask user for their preference
			updateStep(0, 'running', 'Choose Supabase setup method...');
			setNeedsSupabaseChoice(true);
			return; // Wait for user input
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			updateStep(currentStep, 'error', errorMessage);
			setError(errorMessage);
		}
	};

	const mergeEnvFile = (filePath: string, newEntries: Record<string, string>) => {
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
	};

	const continueInstall = async (
		apiKey: string,
		url: string,
		anonKey: string
	) => {
		try {
			// Step 4: Create/update .env files
			setCurrentStep(4);
			updateStep(4, 'running');

			// Root .env
			const rootEnvPath = path.join(process.cwd(), '.env');
			if (!fs.existsSync(rootEnvPath)) {
				// Create with comments if new
				const header = `# Supabase Local Development Credentials
# These are default local development keys from \`supabase start\`
# DO NOT use these in production!

`;
				fs.writeFileSync(rootEnvPath, header);
			}
			mergeEnvFile(rootEnvPath, {
				SUPABASE_URL: url,
				SUPABASE_ANON_KEY: anonKey,
			});

			// Daemon .env
			const daemonEnvPath = path.join(process.cwd(), '..', '..', 'apps', 'daemon', '.env');
			if (!fs.existsSync(daemonEnvPath)) {
				// Create with comments if new
				const header = `# Supabase Configuration
# OpenAI Configuration (for AI summaries)
# Claude Code Home Directory (optional)

`;
				fs.writeFileSync(daemonEnvPath, header);
			}
			mergeEnvFile(daemonEnvPath, {
				SUPABASE_URL: url,
				SUPABASE_ANON_KEY: anonKey,
				OPENAI_API_KEY: apiKey,
				CLAUDE_CODE_HOME: '',
			});

			// Web .env (server-side)
			const webEnvPath = path.join(process.cwd(), '..', '..', 'apps', 'web', '.env');
			if (!fs.existsSync(webEnvPath)) {
				// Create with comments if new
				const header = `# Supabase Local Development Credentials
# These are default local development keys from \`supabase start\`
# DO NOT use these in production!

`;
				fs.writeFileSync(webEnvPath, header);
			}
			mergeEnvFile(webEnvPath, {
				SUPABASE_URL: url,
				SUPABASE_ANON_KEY: anonKey,
			});

			// Web .env.local (client-side)
			const webEnvLocalPath = path.join(process.cwd(), '..', '..', 'apps', 'web', '.env.local');
			mergeEnvFile(webEnvLocalPath, {
				NEXT_PUBLIC_SUPABASE_URL: url,
				NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
			});

			updateStep(4, 'success');

			// Step 5: Install dependencies (monorepo with pnpm)
			setCurrentStep(5);
			updateStep(5, 'running', 'Installing monorepo dependencies with pnpm...');
			const rootPath = path.join(process.cwd(), '..', '..');
			await execAsync('pnpm install', {
				cwd: rootPath,
				maxBuffer: 1024 * 1024 * 10,
			});

			updateStep(5, 'success');

			// Step 6: Setup Python memory service
			setCurrentStep(6);
			updateStep(6, 'running', 'Setting up Python memory service...');
			const memoryServicePath = path.join(process.cwd(), '..', '..', 'apps', 'memory-service');

			try {
				// Check if Python 3 is available
				await execAsync('python3 --version');

				// Create virtual environment if it doesn't exist
				const venvPath = path.join(memoryServicePath, 'venv');
				if (!fs.existsSync(venvPath)) {
					updateStep(6, 'running', 'Creating Python virtual environment...');
					await execAsync('python3 -m venv venv', {
						cwd: memoryServicePath,
					});
				}

				// Install dependencies in venv
				updateStep(6, 'running', 'Installing Python dependencies in venv...');
				const pipInstallCmd = process.platform === 'win32'
					? 'venv\\Scripts\\pip install -r requirements.txt'
					: 'venv/bin/pip install -r requirements.txt';

				await execAsync(pipInstallCmd, {
					cwd: memoryServicePath,
					maxBuffer: 1024 * 1024 * 10,
				});

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
				}

				updateStep(6, 'success', 'Python memory service ready');
			} catch (error) {
				updateStep(6, 'success', 'Python 3 not found - memory service skipped (optional)');
			}

			setCompleted(true);

			// Exit after a short delay to allow the completion message to render
			setTimeout(() => {
				process.exit(0);
			}, 100);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			updateStep(currentStep, 'error', errorMessage);
			setError(errorMessage);

			// Exit with error code after a short delay
			setTimeout(() => {
				process.exit(1);
			}, 100);
		}
	};

	useEffect(() => {
		runInstall();
	}, []);

	// Handle keyboard input for choices
	useInput((input, key) => {
		if (needsSupabaseChoice) {
			if (input === '1') {
				handleSupabaseChoice(false);
			} else if (input === '2') {
				handleSupabaseChoice(true);
			}
		}
	});

	const handleSupabaseChoice = async (useRemote: boolean) => {
		setUseRemoteSupabase(useRemote);
		setNeedsSupabaseChoice(false);
		
		if (useRemote) {
			// Skip local Supabase installation
			updateStep(0, 'success', 'Using remote Supabase (skipped local installation)');
			// Skip steps 1 and 2 (Start Supabase and Extract credentials)
			updateStep(1, 'success', 'Skipped (using remote)');
			updateStep(2, 'success', 'Skipped (using remote)');

			// Ask for remote Supabase credentials
			setCurrentStep(3);
			updateStep(3, 'running', 'Please provide your remote Supabase credentials...');
			setNeedsRemoteCredentials(true);
		} else {
			// Use local Supabase CLI
			try {
				// Check if Supabase CLI is already installed
				await execAsync('supabase --version');
				updateStep(0, 'success', 'Using existing Supabase CLI');
			} catch {
				// Install Supabase CLI locally
				updateStep(0, 'running', 'Installing Supabase CLI...');
				try {
					const isMac = process.platform === 'darwin';
					if (isMac) {
						// Try common Homebrew paths with explicit environment
						const brewPaths = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'];
						let brewPath = '';
						
						for (const path of brewPaths) {
							try {
								await execAsync(`${path} --version`, {
									env: { 
										...process.env, 
										PATH: '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
									}
								});
								brewPath = path;
								break;
							} catch {
								continue;
							}
						}
						
						if (!brewPath) {
							// Fallback: try to install Supabase CLI directly without Homebrew
							updateStep(0, 'running', 'Installing Supabase CLI via curl...');
							await execAsync('curl -fsSL https://supabase.com/install.sh | sh', {
								env: {
									...process.env,
									PATH: '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
								}
							});
							updateStep(0, 'success', 'Installed via curl');
						} else {
							await execAsync(`${brewPath} install supabase/tap/supabase`, {
								env: {
									...process.env,
									PATH: '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
								}
							});
							updateStep(0, 'success', 'Installed via Homebrew');
						}
					} else if (process.platform === 'linux') {
						await execAsync('curl -fsSL https://supabase.com/install.sh | sh');
						updateStep(0, 'success', 'Installed via curl');
					} else {
						throw new Error('Unsupported OS. Please install Supabase CLI manually.');
					}
				} catch (error) {
					throw new Error(`Failed to install Supabase CLI: ${error instanceof Error ? error.message : 'Unknown error'}`);
				}
			}
			
			// Continue with local Supabase setup
			await continueLocalSupabaseSetup();
		}
	};

	const continueLocalSupabaseSetup = async () => {
		// Step 1: Start Supabase
		setCurrentStep(1);
		updateStep(1, 'running');
		try {
			await execAsync('supabase status');
			updateStep(1, 'success', 'Already running');
		} catch {
			updateStep(1, 'running', 'Starting Supabase (this may take a minute)...');
			await execAsync('supabase start', { maxBuffer: 1024 * 1024 * 10 });
			updateStep(1, 'success', 'Started successfully');
		}

		// Step 2: Extract Supabase credentials
		setCurrentStep(2);
		updateStep(2, 'running');
		const { stdout: envOutput } = await execAsync('supabase status -o env');

		// Match both old format (SUPABASE_URL=...) and new format (API_URL="...")
		const urlMatch = envOutput.match(/API_URL="?([^"\n]+)"?/) || envOutput.match(/SUPABASE_URL="?([^"\n]+)"?/);
		const anonMatch = envOutput.match(/ANON_KEY="?([^"\n]+)"?/) || envOutput.match(/SUPABASE_ANON_KEY="?([^"\n]+)"?/);

		if (!urlMatch || !anonMatch) {
			throw new Error('Failed to extract Supabase credentials');
		}

		setSupabaseUrl(urlMatch[1].trim());
		setSupabaseAnonKey(anonMatch[1].trim());
		updateStep(2, 'success');

		// Continue with OpenAI setup
		await continueWithOpenAI(urlMatch[1].trim(), anonMatch[1].trim());
	};

	const continueWithOpenAI = async (url: string, anonKey: string) => {
		// Step 3: Get OpenAI key
		setCurrentStep(3);
		updateStep(3, 'running');

		// Check if already exists
		const daemonEnvPath = path.join(process.cwd(), '..', '..', 'apps', 'daemon', '.env');
		let existingKey = '';
		if (fs.existsSync(daemonEnvPath)) {
			const existingEnv = fs.readFileSync(daemonEnvPath, 'utf-8');
			const keyMatch = existingEnv.match(/OPENAI_API_KEY=(.+)/);
			if (keyMatch && keyMatch[1] !== 'sk-your_openai_api_key_here') {
				existingKey = keyMatch[1].trim();
			}
		}

		if (existingKey) {
			setOpenaiKey(existingKey);
			updateStep(3, 'success', 'Using existing key');
			setCurrentStep(4);
			await continueInstall(existingKey, url, anonKey);
		} else {
			setNeedsOpenaiInput(true);
		}
	};

	const handleRemoteCredentialSubmit = (value: string) => {
		if (currentCredentialInput === 'url') {
			setRemoteSupabaseUrl(value);
			setCurrentCredentialInput('anon');
		} else if (currentCredentialInput === 'anon') {
			setRemoteSupabaseAnonKey(value);
			setNeedsRemoteCredentials(false);
			updateStep(2, 'success', 'Remote credentials provided');

			// Set the credentials for use
			setSupabaseUrl(remoteSupabaseUrl);
			setSupabaseAnonKey(value);

			// Continue with OpenAI setup
			setCurrentStep(3);
			updateStep(3, 'running');
			setNeedsOpenaiInput(true);
		}
	};

	const handleOpenAISubmit = (value: string) => {
		setOpenaiKey(value);
		setNeedsOpenaiInput(false);
		updateStep(3, 'success');
		setCurrentStep(4);

		if (useRemoteSupabase) {
			continueInstall(value, remoteSupabaseUrl, remoteSupabaseAnonKey);
		} else {
			continueInstall(value, supabaseUrl, supabaseAnonKey);
		}
	};

	const getStatusIcon = (status: Step['status']) => {
		switch (status) {
			case 'pending':
				return <Text color="gray">○</Text>;
			case 'running':
				return (
					<Text color="cyan">
						<Spinner type="dots" />
					</Text>
				);
			case 'success':
				return <Text color="green">✓</Text>;
			case 'error':
				return <Text color="red">✗</Text>;
		}
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					🚀 Agent Orchestrator Installation
				</Text>
			</Box>

			{steps.map((step, index) => (
				<Box key={index} marginBottom={0}>
					<Box marginRight={1}>{getStatusIcon(step.status)}</Box>
					<Box flexDirection="column">
						<Text color={step.status === 'success' ? 'green' : 'white'}>
							{step.name}
						</Text>
						{step.message && (
							<Text dimColor color="gray">
								  {step.message}
							</Text>
						)}
					</Box>
				</Box>
			))}

			{needsSupabaseChoice && (
				<Box marginTop={1} flexDirection="column">
					<Text color="yellow">
						<Newline />
						How would you like to set up Supabase?
					</Text>
					<Text color="cyan">1. Use local Supabase (install CLI and start local instance)</Text>
					<Text color="cyan">2. Use remote Supabase (connect to existing project)</Text>
					<Newline />
					<Text color="white">Press 1 for local, 2 for remote:</Text>
					<Text color="gray">(Just press the number key, no need to press Enter)</Text>
				</Box>
			)}

			{needsRemoteCredentials && (
				<Box marginTop={1} flexDirection="column">
					<Text color="yellow">
						<Newline />
						Enter your remote Supabase credentials:
					</Text>
					{currentCredentialInput === 'url' && (
						<>
							<Text color="cyan">1. Supabase URL (e.g., https://your-project.supabase.co):</Text>
							<TextInput value={remoteSupabaseUrl} onChange={setRemoteSupabaseUrl} onSubmit={handleRemoteCredentialSubmit} />
						</>
					)}
					{currentCredentialInput === 'anon' && (
						<>
							<Text color="cyan">2. Supabase Anon Key:</Text>
							<TextInput value={remoteSupabaseAnonKey} onChange={setRemoteSupabaseAnonKey} onSubmit={handleRemoteCredentialSubmit} />
						</>
					)}
				</Box>
			)}

			{needsOpenaiInput && (
				<Box marginTop={1} flexDirection="column">
					<Text color="yellow">
						<Newline />
						Enter your OpenAI API Key:
					</Text>
					<TextInput value={openaiKey} onChange={setOpenaiKey} onSubmit={handleOpenAISubmit} />
				</Box>
			)}

			{error && (
				<Box marginTop={1} borderStyle="round" borderColor="red" padding={1}>
					<Text color="red">Error: {error}</Text>
				</Box>
			)}

			{completed && !error && (
				<Box marginTop={1} flexDirection="column">
					<Box borderStyle="round" borderColor="green" padding={1}>
						<Text color="green" bold>
							✨ Installation Complete!
						</Text>
					</Box>
					<Newline />
					<Text>Next steps:</Text>
					<Text>  1. Run </Text>
					<Text color="cyan">pnpm dev</Text>
					<Text> to start all services</Text>
					<Text>     Or use </Text>
					<Text color="cyan">pnpm dev:daemon</Text>
					<Text> and </Text>
					<Text color="cyan">pnpm dev:web</Text>
					<Text> separately</Text>
					<Text>  2. Access the web app at </Text>
					<Text color="cyan">http://localhost:3000</Text>
					<Newline />
					<Text dimColor>To stop services: Press Ctrl+C</Text>
					<Text dimColor>To stop Supabase later: supabase stop</Text>
				</Box>
			)}
		</Box>
	);
};

render(<InstallApp />);
