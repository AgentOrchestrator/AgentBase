/**
 * electron-builder configuration for Agent Base desktop app
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.agentbase.desktop',
  productName: 'Agent Base',

  directories: {
    output: 'release',
    buildResources: 'build-resources'
  },

  // Include app code and node_modules
  files: [
    'dist/main/**/*',
    {
      from: 'src/renderer/dist',
      to: 'dist/renderer',
      filter: ['**/*']
    },
    'package.json',
    'node_modules/**/*',
    '!**/.turbo/**/*',
    '!**/node_modules/.cache/**/*',
    '!**/node_modules/*/{test,tests,__tests__}/**/*',
    '!**/node_modules/*/*.md',
    '!**/node_modules/*/LICENSE*',
    '!**/node_modules/*/.git/**/*'
  ],

  extraMetadata: {
    main: 'dist/main/src/main/main.js'
  },

  // Disable npm rebuild since we handle it in prepare-build.js
  npmRebuild: false,
  nodeGypRebuild: false,

  // Native modules must be unpacked from asar (can't load .node files from archive)
  asarUnpack: [
    '**/node_modules/node-pty/**/*',
    '**/node_modules/sqlite3/**/*',
    '**/node_modules/keytar/**/*',
    '**/*.node'
  ],

  mac: {
    target: ['dmg'],
    category: 'public.app-category.developer-tools',
    identity: null
  },

  dmg: {
    title: '${productName} ${version}',
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' }
    ]
  }
};
