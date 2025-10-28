#!/usr/bin/env tsx

import React, { useState, useEffect } from 'react';
import { render, Box, Text, Newline } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

type Step = {
	name: string;
	status: 'pending' | 'running' | 'success' | 'error';
	message?: string;
};

const InstallApp = () => {
	const [currentStep, setCurrentStep] = useState(0);
	const [steps, setSteps] = useState<Step[]>([
		{ name: 'Configure Supabase credentials', status: 'pending' },
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
	const [needsSupabaseCredentials, setNeedsSupabaseCredentials] = useState(false);
	const [currentCredentialInput, setCurrentCredentialInput] = useState<'url' | 'anon'>('url');

	const updateStep = (index: number, status: Step['status'], message?: string) => {
		setSteps(prev => {
			const newSteps = [...prev];
			newSteps[index] = { ...newSteps[index], status, message };
			return newSteps;
		});
	};

	const runInstall = async () => {
		try {
			// Step 0: Ask for Supabase credentials
			setCurrentStep(0);
			updateStep(0, 'running', 'Please provide your Supabase credentials...');
			setNeedsSupabaseCredentials(true);
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
			// Step 2: Create/update .env files
			setCurrentStep(2);
			updateStep(2, 'running');

			// Root .env
			const rootEnvPath = path.join(process.cwd(), '..', '..', '.env');
			if (!fs.existsSync(rootEnvPath)) {
				const header = `# Supabase Configuration
# DO NOT use service role keys in client-side code!

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

			// Web .env.local (client-side)
			const webEnvLocalPath = path.join(process.cwd(), '..', '..', 'apps', 'web', '.env.local');
			mergeEnvFile(webEnvLocalPath, {
				NEXT_PUBLIC_SUPABASE_URL: url,
				NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
			});

			updateStep(2, 'success');

			// Step 3: Install dependencies (monorepo with pnpm)
			setCurrentStep(3);
			updateStep(3, 'running', 'Installing monorepo dependencies with pnpm...');
			const rootPath = path.join(process.cwd(), '..', '..');
			await execAsync('pnpm install', {
				cwd: rootPath,
				maxBuffer: 1024 * 1024 * 10,
			});

			updateStep(3, 'success');

			// Step 4: Setup Python memory service
			setCurrentStep(4);
			updateStep(4, 'running', 'Setting up Python memory service...');
			const memoryServicePath = path.join(process.cwd(), '..', '..', 'apps', 'memory-service');

			try {
				// Check if Python 3 is available
				await execAsync('python3 --version');

				// Create virtual environment if it doesn't exist
				const venvPath = path.join(memoryServicePath, 'venv');
				if (!fs.existsSync(venvPath)) {
					updateStep(4, 'running', 'Creating Python virtual environment...');
					await execAsync('python3 -m venv venv', {
						cwd: memoryServicePath,
					});
				}

				// Install dependencies in venv
				updateStep(4, 'running', 'Installing Python dependencies in venv...');
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
SUPABASE_URL=${url}
SUPABASE_SERVICE_ROLE_KEY=  # TODO: Add your service role key
SUPABASE_ANON_KEY=${anonKey}

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

				updateStep(4, 'success', 'Python memory service ready');
			} catch (error) {
				updateStep(4, 'success', 'Python 3 not found - memory service skipped (optional)');
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

	const handleSupabaseCredentialSubmit = (value: string) => {
		if (currentCredentialInput === 'url') {
			setSupabaseUrl(value);
			setCurrentCredentialInput('anon');
		} else if (currentCredentialInput === 'anon') {
			setSupabaseAnonKey(value);
			setNeedsSupabaseCredentials(false);
			updateStep(0, 'success', 'Supabase credentials provided');

			// Continue with OpenAI setup
			setCurrentStep(1);
			updateStep(1, 'running');

			// Check if OpenAI key already exists
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
				setOpenaiKey(existingKey);
				updateStep(1, 'success', 'Using existing key');
				continueInstall(existingKey, supabaseUrl, value);
			} else {
				setNeedsOpenaiInput(true);
			}
		}
	};

	const handleOpenAISubmit = (value: string) => {
		setOpenaiKey(value);
		setNeedsOpenaiInput(false);
		updateStep(1, 'success');
		continueInstall(value, supabaseUrl, supabaseAnonKey);
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

			{needsSupabaseCredentials && (
				<Box marginTop={1} flexDirection="column">
					<Text color="yellow">
						<Newline />
						Enter your Supabase credentials:
					</Text>
					<Text dimColor>
						Get these from your Supabase project settings or from `supabase status` if using local.
					</Text>
					<Newline />
					{currentCredentialInput === 'url' && (
						<>
							<Text color="cyan">Supabase URL (e.g., https://your-project.supabase.co):</Text>
							<TextInput value={supabaseUrl} onChange={setSupabaseUrl} onSubmit={handleSupabaseCredentialSubmit} />
						</>
					)}
					{currentCredentialInput === 'anon' && (
						<>
							<Text color="cyan">Supabase Anon Key:</Text>
							<TextInput value={supabaseAnonKey} onChange={setSupabaseAnonKey} onSubmit={handleSupabaseCredentialSubmit} />
						</>
					)}
				</Box>
			)}

			{needsOpenaiInput && (
				<Box marginTop={1} flexDirection="column">
					<Text color="yellow">
						<Newline />
						Enter your OpenAI API Key (optional - press Enter to skip):
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
				</Box>
			)}
		</Box>
	);
};

render(<InstallApp />);
