import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
    },
  },
  test: {
    globals: true,
    reporters: ['verbose'],
    include: ['**/*.test.{ts,tsx}'],
    // Claude Code worktrees live under .claude/worktrees/, each a full checkout
    // with its own copy of the suite; without this a run from the main
    // checkout collects every one of them as well.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
