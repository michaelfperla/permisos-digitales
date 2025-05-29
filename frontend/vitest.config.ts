import { resolve } from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()] as any,
  // @ts-ignore - vitest config
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-admin/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 70,  // Increased from 30% to professional standards
        branches: 65,    // Increased from 30%
        functions: 70,   // Increased from 30%
        lines: 70        // Increased from 30%
      },
      exclude: [
        'node_modules/',
        'src/test/',
        'src/admin/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/admin/main.tsx',
        '**/index.ts',
        '**/*.stories.*',
        '**/*.story.*'
      ],
      include: [
        'src/**/*.{ts,tsx}',
        '!src/test/**',
        '!src/admin/test/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
