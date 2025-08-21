import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Global test setup
    globals: true,
    
    // Test file patterns
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      '.git',
      'coverage'
    ],
    
    // Test timeout
    testTimeout: 30000,
    
    // Hook timeout
    hookTimeout: 30000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/index.ts',
        'src/server.ts', // Main entry point
        'scripts/',
        'tools/',
        'prisma/',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    
    // Setup files
    setupFiles: [
      './tests/setup/global-setup.ts',
      './tests/setup/test-env.ts'
    ],
    
    // Teardown
    globalTeardown: './tests/setup/global-teardown.ts',
    
    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/index.html',
    },
    
    // Pool options for parallel testing
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
    
    // Retry configuration
    retry: 2,
    
    // Bail on first failure in CI
    bail: process.env.CI ? 1 : 0,
    
    // Watch mode configuration
    watch: !process.env.CI,
    
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    
    // Sequence configuration
    sequence: {
      shuffle: true,
      concurrent: true,
    },
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
    },
  },
  
  // Define configuration for different test types
  define: {
    __TEST__: true,
  },
  
  // ESBuild configuration for TypeScript
  esbuild: {
    target: 'node18',
  },
});

