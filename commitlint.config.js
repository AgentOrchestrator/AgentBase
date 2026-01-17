export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Enforce lowercase for type
    'type-case': [2, 'always', 'lower-case'],
    // Enforce lowercase for subject
    'subject-case': [2, 'always', 'lower-case'],
    // Allow common types
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation only
        'style',    // Formatting, no code change
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'perf',     // Performance improvement
        'test',     // Adding or updating tests
        'build',    // Build system or dependencies
        'ci',       // CI configuration
        'chore',    // Other changes (e.g., updating .gitignore)
        'revert',   // Revert a previous commit
      ],
    ],
  },
};
