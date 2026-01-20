/**
 * electron-builder configuration for Agent Base desktop app
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.agentbase.desktop',
  productName: 'Agent Base',

  directories: {
    output: 'release',
    buildResources: 'build-resources',
  },

  // Include app code and node_modules
  files: [
    'dist/main/**/*',
    {
      from: 'src/renderer/dist',
      to: 'dist/renderer',
      filter: ['**/*'],
    },
    'package.json',
    // Explicitly include node_modules with from/to to bypass workspace detection issues
    {
      from: 'node_modules',
      to: 'node_modules',
      filter: [
        '**/*',
        '!**/.turbo/**',
        '!**/.cache/**',
        '!**/{test,tests,__tests__}/**',
        '!**/*.md',
        '!**/LICENSE*',
        '!**/.git/**',
      ],
    },
  ],

  extraMetadata: {
    main: 'dist/main/src/main/main.js',
  },

  // Disable npm rebuild since we handle it in prepare-build.js
  npmRebuild: false,
  nodeGypRebuild: false,

  // Native modules must be unpacked from asar (can't load .node files from archive)
  asarUnpack: [
    '**/node_modules/node-pty/**/*',
    '**/node_modules/sqlite3/**/*',
    '**/node_modules/keytar/**/*',
    '**/*.node',
  ],

  mac: {
    target: ['dmg', 'zip'],
    category: 'public.app-category.developer-tools',
    // Use environment variable to control signing:
    // - Set CSC_LINK to enable real signing (CI/release builds)
    // - Unset or set to empty for ad-hoc signing (local development)
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build-resources/entitlements.mac.plist',
    entitlementsInherit: 'build-resources/entitlements.mac.plist',
  },

  afterSign: 'scripts/notarize.js',

  dmg: {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder template syntax
    title: '${productName} ${version}',
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
  },
};
