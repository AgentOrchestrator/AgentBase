#!/bin/bash

# Check if running in project root
if [ ! -f "package.json" ]; then
    echo "Error: Please run this script from the agent-orchestrator root directory"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing CLI dependencies..."
    npm install
fi

# Run the Ink-based start CLI
npm run start-cli
