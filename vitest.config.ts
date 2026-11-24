import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'happy-dom',
          include: ['tests/unit/**/*.test.ts'],
          exclude: ['node_modules/**'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'happy-dom',
          include: ['tests/integration/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
