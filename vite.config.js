import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/vitest/**/*.test.js'],
    // Browser smoke scripts were deleted (never wired to CI); vitest owns all automated tests.
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: ['tests/vitest/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/main.js', 'src/config/constants.js'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
});
