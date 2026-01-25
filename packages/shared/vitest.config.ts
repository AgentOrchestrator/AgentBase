import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run tests from src directory, not dist
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**/*', 'node_modules/**/*'],
  },
});
