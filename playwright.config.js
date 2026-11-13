import { defineConfig } from '@playwright/test';
import { pagesBase } from './scripts/pages-base.js';
const baseURL='http://127.0.0.1:4173'+pagesBase({basePath:process.env.VITE_BASE_PATH,repository:process.env.GITHUB_REPOSITORY});
export default defineConfig({
  testDir:'./test/browser', outputDir:'work/playwright-results', workers:1, retries:0, timeout:30000,
  reporter:'list',
  use:{baseURL,viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1,
    screenshot:'only-on-failure',trace:'retain-on-failure',
    launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,
      args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',url:baseURL,reuseExistingServer:!process.env.CI,timeout:30000},
});
