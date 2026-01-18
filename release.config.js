export default {
  branches: ['main'],
  plugins: [
    // Analyze commits to determine version bump
    '@semantic-release/commit-analyzer',
    // Generate release notes from commits
    '@semantic-release/release-notes-generator',
    // Update version in package.json (root)
    [
      '@semantic-release/npm',
      {
        npmPublish: false, // Don't publish to npm registry
      },
    ],
    // Update version in apps/desktop/package.json
    [
      '@semantic-release/exec',
      {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release template syntax
        prepareCmd: 'npm version ${nextRelease.version} --no-git-tag-version --prefix apps/desktop',
      },
    ],
    // Commit the version changes
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'package-lock.json', 'apps/desktop/package.json'],
        // biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release template syntax
        message: 'chore(release): ${nextRelease.version} [skip ci]',
      },
    ],
    // Create GitHub release with notes
    '@semantic-release/github',
  ],
};
