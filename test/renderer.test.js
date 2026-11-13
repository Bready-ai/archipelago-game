import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameRenderer } from '../src/renderer.js';

function fixture(getContext, Renderer=class { constructor(options){this.options=options;} }) {
  const attempts=[],stages=[],canvases=[];
  const diagnostics={setStage:s=>stages.push(s),recordAttempt:a=>attempts.push(a),setContext:c=>{diagnostics.context=c;}};
  const createCanvas=()=>{const canvas={addEventListener(){},removeEventListener(){},getContext:(...args)=>getContext(canvas,...args)};canvases.push(canvas);return canvas;};
  return {run:()=>createGameRenderer({WebGLRenderer:Renderer,createCanvas,touch:true,diagnostics}),attempts,stages,canvases,diagnostics};
}
function gl(overrides={}){return {VERTEX_SHADER:1,FRAGMENT_SHADER:2,HIGH_FLOAT:3,MEDIUM_FLOAT:4,VERSION:5,SHADING_LANGUAGE_VERSION:6,VENDOR:7,RENDERER:8,MAX_TEXTURE_SIZE:9,
 isContextLost:()=>false,getShaderPrecisionFormat:()=>({precision:23}),getContextAttributes:()=>({alpha:false,antialias:false}),getParameter:()=> 'test',getExtension:()=>null,...overrides};}

test('renderer receives the exact WebGL 2 context using the browser GPU choice',()=>{
 const context=gl();const f=fixture((canvas,type,attrs)=>{assert.equal(type,'webgl2');assert.equal(attrs.powerPreference,'default');assert.equal(attrs.antialias,false);return context;});
 const renderer=f.run();assert.equal(renderer.options.context,context);assert.equal(renderer.options.canvas,f.canvases[0]);assert.equal(f.attempts[0].status,'success');
});
test('rejected attribute profiles fall back on new canvases to native defaults',()=>{
 const f=fixture((canvas,type,attrs)=>attrs?null:gl());f.run();
 assert.equal(f.attempts.length,3);assert.equal(new Set(f.canvases).size,3);assert.equal(f.diagnostics.context.profile,'browser-defaults');
 assert.ok(f.attempts.slice(0,2).every(a=>a.error.message.includes('returned null')));
});
test('creation exceptions remain in diagnostics and can recover with another profile',()=>{
 let count=0;const f=fixture(()=>{if(count++===0)throw new DOMException('Driver denied selected attributes','OperationError');return gl();});f.run();
 assert.equal(f.attempts[0].error.name,'OperationError');assert.equal(f.attempts[0].error.message,'Driver denied selected attributes');assert.equal(f.attempts[1].status,'success');
});
test('Three.js initialization errors are preserved instead of being labelled unsupported WebGL',()=>{
 const original=new TypeError('driver capability failure');const f=fixture(()=>gl(),class{constructor(){throw original;}});
 assert.throws(f.run,error=>error===original);assert.equal(f.attempts.length,1);assert.equal(f.attempts[0].phase,'three-renderer');assert.equal(f.attempts[0].contextCreated,true);
});
test('missing precision reports falls back to supported mediump without dereferencing null',()=>{
 const f=fixture(()=>gl({getShaderPrecisionFormat:(shader,type)=>type===3?null:{precision:10}}));
 assert.equal(f.run().options.precision,'mediump');
});
test('all failed profiles retain their distinct errors; no WebGL 1 context is attempted',()=>{
 const f=fixture((canvas,type)=>{assert.equal(type,'webgl2');return null;});
 assert.throws(f.run,/browser-defaults/);assert.equal(f.attempts.length,3);assert.ok(f.attempts.every(a=>a.status==='failed'));
});
