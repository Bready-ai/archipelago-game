import {execFileSync} from 'node:child_process';

// Workers hosts this game at the origin root; GitHub Pages keeps its own base.
const env={...process.env,VITE_BASE_PATH:'/'};
for(const args of [['node_modules/vite/bin/vite.js','build'],['scripts/check-dist.js']]){
  execFileSync(process.execPath,args,{env,stdio:'inherit'});
}
