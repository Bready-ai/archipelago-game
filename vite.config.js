import { defineConfig } from 'vite';
import { pagesBase } from './scripts/pages-base.js';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : pagesBase({
    basePath: process.env.VITE_BASE_PATH,
    repository: process.env.GITHUB_REPOSITORY,
  }),
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
}));
