import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { pagesBase } from './scripts/pages-base.js';

let buildId=process.env.GITHUB_SHA?.slice(0,12);
if(!buildId){try{buildId=execFileSync('git',['rev-parse','--short=12','HEAD'],{encoding:'utf8'}).trim();}catch{buildId='local';}}

export default defineConfig(({ command, isPreview }) => ({
  plugins: [{name:'game-build-id',transformIndexHtml:html=>html.replaceAll('__GAME_BUILD_ID__',buildId)}],
  base: command === 'serve' && !isPreview ? '/' : pagesBase({
    basePath: process.env.VITE_BASE_PATH,
    repository: process.env.GITHUB_REPOSITORY,
  }),
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
}));
