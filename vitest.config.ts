import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['extension/src/**/*.ts'],
      exclude: ['extension/src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': '/extension/src',
    },
  },
});
