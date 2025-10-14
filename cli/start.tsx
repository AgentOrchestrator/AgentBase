#!/usr/bin/env tsx

import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

type Service = {
	name: string;
	status: 'starting' | 'running' | 'error' | 'stopped';
	pid?: number;
	url?: string;
	message?: string;
};

const StartApp = () => {
	const { exit } = useApp();
	const [services, setServices] = useState<Service[]>([
		{ name: 'Supabase', status: 'starting', url: 'http://localhost:54323' },
		{ name: 'Daemon', status: 'starting' },
		{ name: 'Web App', status: 'starting', url: 'http://localhost:3000' },
	]);
	const [allRunning, setAllRunning] = useState(false);
	const [error, setError] = useState<string | null>(null);
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

			// Start Supabase
			updateService('Supabase', { status: 'starting', message: 'Checking status...' });
			try {
				await execAsync('supabase status');
				updateService('Supabase', { status: 'running', message: 'Already running' });
			} catch {
				updateService('Supabase', { status: 'starting', message: 'Starting...' });
				await execAsync('supabase start', { maxBuffer: 1024 * 1024 * 10 });
				updateService('Supabase', { status: 'running', message: 'Started' });
			}

			// Start Daemon
			updateService('Daemon', { status: 'starting', message: 'Launching...' });
			const daemonProcess = spawn('npm', ['run', 'dev'], {
				cwd: path.join(process.cwd(), 'agent-orchestrator-daemon'),
				stdio: ['ignore', 'pipe', 'pipe'],
				detached: false,
			});

			processesRef.current.push(daemonProcess);

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

			// Pipe daemon logs to file
			const daemonLog = fs.createWriteStream(path.join(process.cwd(), 'daemon.log'), {
				flags: 'a',
			});
			daemonProcess.stdout?.pipe(daemonLog);
			daemonProcess.stderr?.pipe(daemonLog);

			// Start Web App
			updateService('Web App', { status: 'starting', message: 'Launching...' });
			const webProcess = spawn('npm', ['run', 'dev'], {
				cwd: path.join(process.cwd(), 'web'),
				stdio: ['ignore', 'pipe', 'pipe'],
				detached: false,
			});

			processesRef.current.push(webProcess);

			// Wait a bit for web to start
			await new Promise(resolve => setTimeout(resolve, 3000));

			if (webProcess.killed) {
				throw new Error('Web app failed to start');
			}

			updateService('Web App', {
				status: 'running',
				pid: webProcess.pid,
				message: `PID: ${webProcess.pid}`,
			});

			// Pipe web logs to file
			const webLog = fs.createWriteStream(path.join(process.cwd(), 'web.log'), { flags: 'a' });
			webProcess.stdout?.pipe(webLog);
			webProcess.stderr?.pipe(webLog);

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
