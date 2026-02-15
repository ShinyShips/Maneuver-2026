import path from 'path';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

const env = loadEnv('test', process.cwd(), '');
Object.assign(process.env, env);

export default defineConfig({
  resolve: {
    alias: {
      '@/core': path.resolve(__dirname, './src/core'),
      '@/game': path.resolve(__dirname, './src/game-template'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
