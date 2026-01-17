#!/usr/bin/env node
/**
 * Prepares the desktop app for electron-builder packaging.
 *
 * In a monorepo with npm workspaces, dependencies are hoisted to root node_modules.
 * This script uses package-lock.json to find all transitive production dependencies
 * and copies them to the local node_modules for electron-builder to bundle.
 */
const fs = require('node:fs');
const path = require('node:path');

const APP_DIR = path.resolve(__dirname, '..');
const MONOREPO_ROOT = path.resolve(APP_DIR, '../..');
const ROOT_NODE_MODULES = path.join(MONOREPO_ROOT, 'node_modules');
const LOCAL_NODE_MODULES = path.join(APP_DIR, 'node_modules');
const LOCKFILE_PATH = path.join(MONOREPO_ROOT, 'package-lock.json');

/**
 * Parse package-lock.json and extract all dependencies for a given package path
 */
function getAllDependencies(lockfile, packagePath) {
  const deps = new Set();
  const packages = lockfile.packages || {};

  // Find the desktop app entry in the lockfile
  const appEntry = packages[packagePath];
  if (!appEntry) {
    console.error(`  ⚠ Could not find ${packagePath} in package-lock.json`);
    return deps;
  }

  // Recursively collect all production dependencies
  function collectDeps(pkgPath) {
    const pkg = packages[pkgPath];
    if (!pkg) return;

    const prodDeps = pkg.dependencies || {};
    for (const depName of Object.keys(prodDeps)) {
      if (deps.has(depName)) continue;
      deps.add(depName);

      // The dependency could be at root level or nested
      // Check root node_modules first (hoisted)
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
    console.log(`  ⚠ ${moduleName} not found in root node_modules`);
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
    return true; // Already copied
  }

  // Remove symlink if exists
  if (destStat?.isSymbolicLink()) {
    fs.unlinkSync(destPath);
  }

  // Resolve symlinks in source (for workspace packages)
  const realSourcePath = fs.realpathSync(sourcePath);
  fs.cpSync(realSourcePath, destPath, { recursive: true });
  return true;
}

console.log('Preparing build for electron-builder...');

// Ensure local node_modules exists
if (!fs.existsSync(LOCAL_NODE_MODULES)) {
  fs.mkdirSync(LOCAL_NODE_MODULES, { recursive: true });
}

// Read package-lock.json
if (!fs.existsSync(LOCKFILE_PATH)) {
  console.error('ERROR: package-lock.json not found at root. Run npm install first.');
  process.exit(1);
}

const lockfile = JSON.parse(fs.readFileSync(LOCKFILE_PATH, 'utf8'));
console.log(`  Lockfile version: ${lockfile.lockfileVersion}`);

// Get all dependencies for the desktop app
const allDeps = getAllDependencies(lockfile, 'apps/desktop');
console.log(`  Found ${allDeps.size} total production dependencies`);

// Copy all dependencies
let copied = 0;
for (const dep of allDeps) {
  if (copyModule(dep)) {
    copied++;
  }
}

console.log(`  Copied ${copied} modules to local node_modules`);
console.log('Build preparation complete.');
