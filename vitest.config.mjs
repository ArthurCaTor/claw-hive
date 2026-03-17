import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit.test.js'],
    exclude: ['node_modules/', 'dashboard/', 'public/', 'tests/smoke.test.js'],
    environment: 'node',
    globals: true,
    root: '.',
  },
});
