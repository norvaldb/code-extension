import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/extension.ts'],
    },
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, '__mocks__/vscode.ts'),
    },
  },
});
