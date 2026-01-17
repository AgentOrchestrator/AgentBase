#!/usr/bin/env node
/**
 * Prepares the desktop app for electron-builder packaging.
 *
 * In a monorepo with npm workspaces:
 * 1. Dependencies are hoisted to root node_modules
 * 2. Workspace packages are symlinked
 *
 * This script copies required dependencies from root to local node_modules
 * so electron-builder can bundle them correctly.
 */
const fs = require('fs');
const path = require('path');

const APP_DIR = path.resolve(__dirname, '..');
const MONOREPO_ROOT = path.resolve(APP_DIR, '../..');
const ROOT_NODE_MODULES = path.join(MONOREPO_ROOT, 'node_modules');
const LOCAL_NODE_MODULES = path.join(APP_DIR, 'node_modules');

// Read production dependencies from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8'));
const prodDependencies = Object.keys(packageJson.dependencies || {});

console.log('Preparing build for electron-builder...');
console.log(`  Found ${prodDependencies.length} production dependencies`);

// Ensure local node_modules exists
if (!fs.existsSync(LOCAL_NODE_MODULES)) {
  fs.mkdirSync(LOCAL_NODE_MODULES, { recursive: true });
}

// Copy each production dependency from root to local
for (const dep of prodDependencies) {
  const sourcePath = path.join(ROOT_NODE_MODULES, dep);
  const destPath = path.join(LOCAL_NODE_MODULES, dep);

  if (!fs.existsSync(sourcePath)) {
    console.log(`  ⚠ ${dep} not found in root node_modules, skipping`);
    continue;
  }

  // Skip if already exists and is not a symlink
  const destStat = fs.existsSync(destPath) ? fs.lstatSync(destPath) : null;
  if (destStat && !destStat.isSymbolicLink()) {
    continue;
  }

  // Remove symlink if exists
  if (destStat && destStat.isSymbolicLink()) {
    fs.unlinkSync(destPath);
  }

  // Resolve symlinks in source
  const realSourcePath = fs.realpathSync(sourcePath);

  console.log(`  Copying: ${dep}`);
  fs.cpSync(realSourcePath, destPath, { recursive: true });
}

// Also copy transitive native dependencies that might be needed
const nativeModules = ['node-pty', 'sqlite3', 'keytar', 'node-addon-api', 'prebuild-install', 'node-gyp-build'];
for (const mod of nativeModules) {
  const sourcePath = path.join(ROOT_NODE_MODULES, mod);
  const destPath = path.join(LOCAL_NODE_MODULES, mod);

  if (!fs.existsSync(sourcePath)) continue;
  if (fs.existsSync(destPath) && !fs.lstatSync(destPath).isSymbolicLink()) continue;

  if (fs.existsSync(destPath) && fs.lstatSync(destPath).isSymbolicLink()) {
    fs.unlinkSync(destPath);
  }

  const realSourcePath = fs.realpathSync(sourcePath);
  console.log(`  Copying native module: ${mod}`);
  fs.cpSync(realSourcePath, destPath, { recursive: true });
}

console.log('Build preparation complete.');
