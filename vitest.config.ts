import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      obsidian: '/Users/mykolasarry/Projects/straven-obsidian-claude-mcp/src/__mocks__/obsidian.ts',
    },
  },
});
