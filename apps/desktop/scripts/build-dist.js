#!/usr/bin/env node
/**
 * Complete build script for Agent Base desktop app distribution.
 *
 * This script handles the full build pipeline for creating a distributable DMG:
 * 1. Build the shared package (workspace dependency)
 * 2. Build the Vite renderer (React frontend)
 * 3. Compile the Electron main process
 * 4. Copy all production dependencies from monorepo root
 * 5. Run electron-builder to create the DMG
 *
 * Usage: node scripts/build-dist.js
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_DIR = path.resolve(__dirname, '..');
const MONOREPO_ROOT = path.resolve(APP_DIR, '../..');
const ROOT_NODE_MODULES = path.join(MONOREPO_ROOT, 'node_modules');
const LOCAL_NODE_MODULES = path.join(APP_DIR, 'node_modules');
const LOCKFILE_PATH = path.join(MONOREPO_ROOT, 'package-lock.json');

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${ step }] ${message}`, colors.bright + colors.blue);
}

function logSuccess(message) {
  log(`  ✓ ${message}`, colors.green);
}

function logWarning(message) {
  log(`  ⚠ ${message}`, colors.yellow);
}

function logError(message) {
  log(`  ✗ ${message}`, colors.red);
}

function run(command, options = {}) {
  const defaultOptions = {
    cwd: APP_DIR,
    stdio: 'inherit',
    shell: true,
  };
  const result = spawnSync(command, { ...defaultOptions, ...options });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command}`);
  }
  return result;
}

/**
 * Parse package-lock.json and extract all dependencies for a given package path
 */
function getAllDependencies(lockfile, packagePath) {
  const deps = new Set();
  const packages = lockfile.packages || {};

  const appEntry = packages[packagePath];
  if (!appEntry) {
    logWarning(`Could not find ${packagePath} in package-lock.json`);
    return deps;
  }

  function collectDeps(pkgPath) {
    const pkg = packages[pkgPath];
    if (!pkg) return;

    const prodDeps = pkg.dependencies || {};
    for (const depName of Object.keys(prodDeps)) {
      if (deps.has(depName)) continue;
      deps.add(depName);

      const rootDepPath = `node_modules/${depName}`;
      if (packages[rootDepPath]) {
        collectDeps(rootDepPath);
      }
    }
  }

  collectDeps(packagePath);
  return deps;
}

/**
 * Copy a module from root to local node_modules
 */
function copyModule(moduleName) {
  const sourcePath = path.join(ROOT_NODE_MODULES, moduleName);
  const destPath = path.join(LOCAL_NODE_MODULES, moduleName);

  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  // For scoped packages, ensure parent directory exists
  if (moduleName.startsWith('@')) {
    const scopeDir = path.join(LOCAL_NODE_MODULES, moduleName.split('/')[0]);
    if (!fs.existsSync(scopeDir)) {
      fs.mkdirSync(scopeDir, { recursive: true });
    }
  }

  // Skip if already exists and is not a symlink
  const destStat = fs.existsSync(destPath) ? fs.lstatSync(destPath) : null;
  if (destStat && !destStat.isSymbolicLink()) {
    return true;
  }

  // Remove symlink if exists
  if (destStat && destStat.isSymbolicLink()) {
    fs.unlinkSync(destPath);
  }

  // Resolve symlinks in source (for workspace packages)
  const realSourcePath = fs.realpathSync(sourcePath);
  fs.cpSync(realSourcePath, destPath, { recursive: true });
  return true;
}

async function main() {
  const startTime = Date.now();

  log('\n╔════════════════════════════════════════════════════════════╗', colors.bright);
  log('║           Agent Base - Distribution Build                  ║', colors.bright);
  log('╚════════════════════════════════════════════════════════════╝', colors.bright);

  try {
    // Step 1: Build shared package
    logStep('1/5', 'Building shared package (@agent-orchestrator/shared)');
    run('npm run build --workspace=@agent-orchestrator/shared', { cwd: MONOREPO_ROOT });
    logSuccess('Shared package built');

    // Step 2: Build Vite renderer
    logStep('2/5', 'Building Vite renderer (React frontend)');
    run('npm run build');
    logSuccess('Renderer built');

    // Step 3: Compile main process
    logStep('3/5', 'Compiling Electron main process (TypeScript)');
    run('npm run build:main');
    logSuccess('Main process compiled');

    // Step 4: Copy dependencies
    logStep('4/5', 'Copying production dependencies from monorepo root');

    if (!fs.existsSync(LOCAL_NODE_MODULES)) {
      fs.mkdirSync(LOCAL_NODE_MODULES, { recursive: true });
    }

    if (!fs.existsSync(LOCKFILE_PATH)) {
      throw new Error('package-lock.json not found at root. Run npm install first.');
    }

    const lockfile = JSON.parse(fs.readFileSync(LOCKFILE_PATH, 'utf8'));
    log(`  Lockfile version: ${lockfile.lockfileVersion}`);

    const allDeps = getAllDependencies(lockfile, 'apps/desktop');
    log(`  Found ${allDeps.size} production dependencies`);

    let copied = 0;
    let skipped = 0;
    for (const dep of allDeps) {
      if (copyModule(dep)) {
        copied++;
      } else {
        skipped++;
      }
    }

    logSuccess(`Copied ${copied} modules (${skipped} not found in root)`);

    // Step 5: Run electron-builder
    logStep('5/5', 'Creating DMG with electron-builder');
    run('npx electron-builder --config electron-builder.config.js');
    logSuccess('DMG created');

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log('\n╔════════════════════════════════════════════════════════════╗', colors.green);
    log('║                    Build Complete!                         ║', colors.green);
    log('╚════════════════════════════════════════════════════════════╝', colors.green);
    log(`\n  Time: ${elapsed}s`, colors.bright);
    log(`  Output: ${path.join(APP_DIR, 'release')}`, colors.bright);

    // List output files
    const releaseDir = path.join(APP_DIR, 'release');
    if (fs.existsSync(releaseDir)) {
      const files = fs.readdirSync(releaseDir).filter(f => f.endsWith('.dmg'));
      for (const file of files) {
        const filePath = path.join(releaseDir, file);
        const stats = fs.statSync(filePath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
        log(`  → ${file} (${sizeMB} MB)`, colors.green);
      }
    }
    log('');

  } catch (error) {
    logError(`Build failed: ${error.message}`);
    process.exit(1);
  }
}

main();
