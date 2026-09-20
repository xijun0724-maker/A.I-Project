import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/vitest/**/*.test.js'],
    exclude: ['tests/functional.test.js', 'tests/peek.test.js', 'tests/empty-state.test.js', 'tests/design-check.test.js'],
    setupFiles: ['tests/vitest/setup.js'],
  },
});
