#!/usr/bin/env tsx

import React, { useState, useEffect } from 'react';
import { render, Box, Text, Newline } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { exec, execSync } from 'child_process';
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
		{ name: 'Pull git submodules', status: 'pending' },
		{ name: 'Check Supabase CLI', status: 'pending' },
		{ name: 'Start Supabase', status: 'pending' },
		{ name: 'Extract Supabase credentials', status: 'pending' },
		{ name: 'Configure OpenAI API Key', status: 'pending' },
		{ name: 'Create .env files', status: 'pending' },
		{ name: 'Install dependencies', status: 'pending' },
	]);
	const [openaiKey, setOpenaiKey] = useState('');
	const [needsOpenaiInput, setNeedsOpenaiInput] = useState(false);
	const [supabaseUrl, setSupabaseUrl] = useState('');
	const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
	const [supabaseServiceKey, setSupabaseServiceKey] = useState('');
	const [completed, setCompleted] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const updateStep = (index: number, status: Step['status'], message?: string) => {
		setSteps(prev => {
			const newSteps = [...prev];
			newSteps[index] = { ...newSteps[index], status, message };
			return newSteps;
		});
	};

	const runInstall = async () => {
		try {
			// Step 0: Pull submodules
			setCurrentStep(0);
			updateStep(0, 'running');
			try {
				await execAsync('git submodule update --init --recursive');
				updateStep(0, 'success');
			} catch (submoduleError) {
				const errorMsg = submoduleError instanceof Error ? submoduleError.message : '';
				if (errorMsg.includes('Permission denied') || errorMsg.includes('could not read')) {
					throw new Error(
						'Failed to access private submodules. Please ensure:\n' +
						'  1. You have SSH keys set up with GitHub\n' +
						'  2. Your SSH key is added to your GitHub account\n' +
						'  3. You have access to both agent-orchestrator-daemon and agent-orchestrator-web repositories'
					);
				}
				throw submoduleError;
			}

			// Step 1: Check Supabase CLI
			setCurrentStep(1);
			updateStep(1, 'running');
			try {
				const { stdout } = await execAsync('supabase --version');
				updateStep(1, 'success', stdout.trim());
			} catch {
				// Try to install Supabase CLI
				updateStep(1, 'running', 'Installing Supabase CLI...');
				const isMac = process.platform === 'darwin';
				if (isMac) {
					try {
						await execAsync('brew --version');
						await execAsync('brew install supabase/tap/supabase');
						updateStep(1, 'success', 'Installed via Homebrew');
					} catch {
						throw new Error('Homebrew not found. Please install Homebrew first.');
					}
				} else if (process.platform === 'linux') {
					await execAsync('curl -fsSL https://supabase.com/install.sh | sh');
					updateStep(1, 'success', 'Installed via curl');
				} else {
					throw new Error('Unsupported OS. Please install Supabase CLI manually.');
				}
			}

			// Step 2: Start Supabase
			setCurrentStep(2);
			updateStep(2, 'running');
			try {
				await execAsync('supabase status');
				updateStep(2, 'success', 'Already running');
			} catch {
				updateStep(2, 'running', 'Starting Supabase (this may take a minute)...');
				await execAsync('supabase start', { maxBuffer: 1024 * 1024 * 10 });
				updateStep(2, 'success', 'Started successfully');
			}

			// Step 3: Extract Supabase credentials
			setCurrentStep(3);
			updateStep(3, 'running');
			const { stdout: envOutput } = await execAsync('supabase status -o env');

			// Match both old format (SUPABASE_URL=...) and new format (API_URL="...")
			const urlMatch = envOutput.match(/API_URL="?([^"\n]+)"?/) || envOutput.match(/SUPABASE_URL="?([^"\n]+)"?/);
			const anonMatch = envOutput.match(/ANON_KEY="?([^"\n]+)"?/) || envOutput.match(/SUPABASE_ANON_KEY="?([^"\n]+)"?/);
			const serviceMatch = envOutput.match(/SERVICE_ROLE_KEY="?([^"\n]+)"?/) || envOutput.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)"?/);

			if (!urlMatch || !anonMatch || !serviceMatch) {
				throw new Error('Failed to extract Supabase credentials');
			}

			setSupabaseUrl(urlMatch[1].trim());
			setSupabaseAnonKey(anonMatch[1].trim());
			setSupabaseServiceKey(serviceMatch[1].trim());
			updateStep(3, 'success');

			// Step 4: Get OpenAI key
			setCurrentStep(4);
			updateStep(4, 'running');

			// Check if already exists
			const daemonEnvPath = path.join(process.cwd(), 'agent-orchestrator-daemon', '.env');
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
				updateStep(4, 'success', 'Using existing key');
				setCurrentStep(5);
				await continueInstall(existingKey, urlMatch[1].trim(), anonMatch[1].trim(), serviceMatch[1].trim());
			} else {
				setNeedsOpenaiInput(true);
			}
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
		anonKey: string,
		serviceKey: string
	) => {
		try {
			// Step 5: Create/update .env files
			setCurrentStep(5);
			updateStep(5, 'running');

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
				SUPABASE_SERVICE_ROLE_KEY: serviceKey,
			});

			// Daemon .env
			const daemonEnvPath = path.join(process.cwd(), 'agent-orchestrator-daemon', '.env');
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
				SUPABASE_KEY: anonKey,
				SUPABASE_SERVICE_ROLE_KEY: serviceKey,
				OPENAI_API_KEY: apiKey,
				CLAUDE_CODE_HOME: '',
			});

			// Web .env.local
			const webEnvPath = path.join(process.cwd(), 'web', '.env.local');
			mergeEnvFile(webEnvPath, {
				NEXT_PUBLIC_SUPABASE_URL: url,
				NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
			});

			updateStep(5, 'success');

			// Step 6: Install dependencies
			setCurrentStep(6);
			updateStep(6, 'running', 'Installing web dependencies...');
			await execAsync('npm install', {
				cwd: path.join(process.cwd(), 'web'),
				maxBuffer: 1024 * 1024 * 10,
			});

			updateStep(6, 'running', 'Installing daemon dependencies...');
			await execAsync('npm install', {
				cwd: path.join(process.cwd(), 'agent-orchestrator-daemon'),
				maxBuffer: 1024 * 1024 * 10,
			});

			updateStep(6, 'success');
			setCompleted(true);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			updateStep(currentStep, 'error', errorMessage);
			setError(errorMessage);
		}
	};

	useEffect(() => {
		runInstall();
	}, []);

	const handleOpenAISubmit = (value: string) => {
		setOpenaiKey(value);
		setNeedsOpenaiInput(false);
		updateStep(4, 'success');
		setCurrentStep(5);
		continueInstall(value, supabaseUrl, supabaseAnonKey, supabaseServiceKey);
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
					<Text color="cyan">./start.sh</Text>
					<Text> to start the web app and daemon</Text>
					<Text>  2. Access the web app at </Text>
					<Text color="cyan">http://localhost:3000</Text>
					<Newline />
					<Text dimColor>To stop Supabase later: supabase stop</Text>
				</Box>
			)}
		</Box>
	);
};

render(<InstallApp />);
