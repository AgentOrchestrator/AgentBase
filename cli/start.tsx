#!/usr/bin/env tsx

import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { waitForHealthy } from './utils/health-check.js';

const execAsync = promisify(exec);

type Service = {
	name: string;
	status: 'starting' | 'running' | 'error' | 'stopped';
	pid?: number;
	url?: string;
	message?: string;
};

type AuthPrompt = {
	url: string;
	timestamp: number;
};

const StartApp = () => {
	const { exit } = useApp();
	const [services, setServices] = useState<Service[]>([
		{ name: 'Supabase', status: 'starting', url: 'http://localhost:54323' },
		{ name: 'Web App', status: 'starting', url: 'http://localhost:3000' },
		{ name: 'Daemon', status: 'starting' },
	]);
	const [allRunning, setAllRunning] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [authPrompt, setAuthPrompt] = useState<AuthPrompt | null>(null);
	const processesRef = useRef<any[]>([]);

	const updateService = (name: string, updates: Partial<Service>) => {
		setServices(prev =>
			prev.map(service => (service.name === name ? { ...service, ...updates } : service))
		);
	};

	const startServices = async () => {
		try {
			// Check if .env files exist
			const rootEnv = path.join(process.cwd(), '.env');
			const daemonEnv = path.join(process.cwd(), 'agent-orchestrator-daemon', '.env');
			const webEnv = path.join(process.cwd(), 'web', '.env.local');

			if (!fs.existsSync(rootEnv) || !fs.existsSync(daemonEnv) || !fs.existsSync(webEnv)) {
				throw new Error('Environment files not found. Please run ./install.sh first');
			}

			// Check if node_modules exist
			const webModules = path.join(process.cwd(), 'web', 'node_modules');
			const daemonModules = path.join(process.cwd(), 'agent-orchestrator-daemon', 'node_modules');

			if (!fs.existsSync(webModules) || !fs.existsSync(daemonModules)) {
				throw new Error('Dependencies not installed. Please run ./install.sh first');
			}

			// Check if using remote Supabase
			const rootEnvContent = fs.readFileSync(rootEnv, 'utf-8');
			const isRemoteSupabase = rootEnvContent.includes('https://') && rootEnvContent.includes('.supabase.co');
			
			if (isRemoteSupabase) {
				// Using remote Supabase - skip local startup
				updateService('Supabase', { 
					status: 'running', 
					message: 'Using remote Supabase',
					url: 'Remote instance'
				});
			} else {
				// Start local Supabase
				updateService('Supabase', { status: 'starting', message: 'Checking status...' });
				try {
					await execAsync('supabase status');
					updateService('Supabase', { status: 'running', message: 'Already running' });
				} catch {
					updateService('Supabase', { status: 'starting', message: 'Starting...' });
					await execAsync('supabase start', { maxBuffer: 1024 * 1024 * 10 });
					updateService('Supabase', { status: 'running', message: 'Started' });
				}
			}

			// Start Web App FIRST (daemon needs web to be ready for auth)
			updateService('Web App', { status: 'starting', message: 'Launching...' });
			const webProcess = spawn('npm', ['run', 'dev'], {
				cwd: path.join(process.cwd(), 'web'),
				stdio: ['ignore', 'pipe', 'pipe'],
				detached: false,
			});

			processesRef.current.push(webProcess);

			// Pipe web logs to file
			const webLog = fs.createWriteStream(path.join(process.cwd(), 'web.log'), { flags: 'a' });
			webProcess.stdout?.pipe(webLog);
			webProcess.stderr?.pipe(webLog);

			// Wait for web app to be healthy
			updateService('Web App', { status: 'starting', message: 'Waiting for health check...' });
			const webHealthy = await waitForHealthy('http://localhost:3000', 60000, 1000);

			if (!webHealthy) {
				throw new Error('Web app failed to become healthy within 60 seconds');
			}

			if (webProcess.killed) {
				throw new Error('Web app process died');
			}

			updateService('Web App', {
				status: 'running',
				pid: webProcess.pid,
				message: `PID: ${webProcess.pid}`,
			});

			// Now start Daemon (web is ready for auth redirects)
			updateService('Daemon', { status: 'starting', message: 'Launching...' });
			const daemonProcess = spawn('npm', ['run', 'dev'], {
				cwd: path.join(process.cwd(), 'agent-orchestrator-daemon'),
				stdio: ['ignore', 'pipe', 'pipe'],
				detached: false,
			});

			processesRef.current.push(daemonProcess);

			// Pipe daemon logs to file and monitor for auth messages
			const daemonLog = fs.createWriteStream(path.join(process.cwd(), 'daemon.log'), {
				flags: 'a',
			});

			// Monitor stdout for auth messages
			let stdoutBuffer = '';
			daemonProcess.stdout?.on('data', (data) => {
				const text = data.toString();
				daemonLog.write(data);

				// Buffer the output to detect auth URL
				stdoutBuffer += text;

				// Check for authentication URL pattern
				const urlMatch = stdoutBuffer.match(/daemon-auth\?device_id=([a-f0-9-]+)/);
				if (urlMatch) {
					const webUrl = process.env.WEB_URL || 'http://localhost:3000';
					const authUrl = `${webUrl}/daemon-auth?device_id=${urlMatch[1]}`;
					setAuthPrompt({ url: authUrl, timestamp: Date.now() });
				}

				// Check for successful authentication
				if (text.includes('Authentication successful') || text.includes('✓ Authentication successful')) {
					setAuthPrompt(null);
				}

				// Keep buffer size reasonable
				if (stdoutBuffer.length > 10000) {
					stdoutBuffer = stdoutBuffer.slice(-5000);
				}
			});

			daemonProcess.stderr?.pipe(daemonLog);

			// Wait a bit for daemon to start
			await new Promise(resolve => setTimeout(resolve, 2000));

			if (daemonProcess.killed) {
				throw new Error('Daemon failed to start');
			}

			updateService('Daemon', {
				status: 'running',
				pid: daemonProcess.pid,
				message: `PID: ${daemonProcess.pid}`,
			});

			setAllRunning(true);

			// Handle process exits
			daemonProcess.on('exit', (code) => {
				updateService('Daemon', { status: 'stopped', message: `Exited with code ${code}` });
			});

			webProcess.on('exit', (code) => {
				updateService('Web App', { status: 'stopped', message: `Exited with code ${code}` });
			});
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			setError(errorMessage);
		}
	};

	useEffect(() => {
		startServices();

		// Cleanup on unmount
		return () => {
			processesRef.current.forEach(proc => {
				if (proc && !proc.killed) {
					proc.kill('SIGTERM');
				}
			});
		};
	}, []);

	// Handle Ctrl+C
	useEffect(() => {
		const handleExit = () => {
			processesRef.current.forEach(proc => {
				if (proc && !proc.killed) {
					proc.kill('SIGTERM');
				}
			});
			exit();
		};

		process.on('SIGINT', handleExit);
		process.on('SIGTERM', handleExit);

		return () => {
			process.removeListener('SIGINT', handleExit);
			process.removeListener('SIGTERM', handleExit);
		};
	}, [exit]);

	const getStatusIcon = (status: Service['status']) => {
		switch (status) {
			case 'starting':
				return (
					<Text color="cyan">
						<Spinner type="dots" />
					</Text>
				);
			case 'running':
				return <Text color="green">●</Text>;
			case 'error':
				return <Text color="red">✗</Text>;
			case 'stopped':
				return <Text color="gray">○</Text>;
		}
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					🚀 Agent Orchestrator
				</Text>
			</Box>

			{services.map((service, index) => (
				<Box key={index} marginBottom={0}>
					<Box marginRight={1}>{getStatusIcon(service.status)}</Box>
					<Box flexDirection="column" flexGrow={1}>
						<Box>
							<Text color={service.status === 'running' ? 'green' : 'white'}>
								{service.name}
							</Text>
							{service.url && service.status === 'running' && (
								<Text dimColor> - <Text color="cyan">{service.url}</Text></Text>
							)}
						</Box>
						{service.message && (
							<Text dimColor color="gray">
								  {service.message}
							</Text>
						)}
					</Box>
				</Box>
			))}

			{error && (
				<Box marginTop={1} borderStyle="round" borderColor="red" padding={1}>
					<Text color="red">Error: {error}</Text>
				</Box>
			)}

			{authPrompt && (
				<Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
					<Text bold color="cyan">🔐 Authentication Required</Text>
					<Box marginTop={1} flexDirection="column">
						<Text>Please click the link below to authenticate:</Text>
						<Box marginTop={1}>
							<Text color="cyan">{`\x1b]8;;${authPrompt.url}\x1b\\🔗 Open Authentication Page\x1b]8;;\x1b\\`}</Text>
						</Box>
						<Box marginTop={1}>
							<Text dimColor>Or copy: <Text color="cyan">{authPrompt.url}</Text></Text>
						</Box>
					</Box>
				</Box>
			)}

			{allRunning && !error && (
				<Box marginTop={1} flexDirection="column">
					<Box borderStyle="round" borderColor="green" padding={1}>
						<Text color="green">✨ All services running!</Text>
					</Box>
					<Box marginTop={1} flexDirection="column">
						<Text>Logs:</Text>
						<Text>  Web:    </Text>
						<Text color="gray">tail -f web.log</Text>
						<Text>  Daemon: </Text>
						<Text color="gray">tail -f daemon.log</Text>
					</Box>
					<Box marginTop={1}>
						<Text color="yellow">Press Ctrl+C to stop all services</Text>
					</Box>
				</Box>
			)}
		</Box>
	);
};

render(<StartApp />);
