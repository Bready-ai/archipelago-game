import test from 'node:test';
import assert from 'node:assert/strict';
import { joystickVector, assistedAim } from '../src/mobile-controls.js';
import { chooseQuality, renderRatio } from '../src/quality.js';
import { pagesBase } from '../scripts/pages-base.js';
import { Combat, dist } from '../src/combat.js';

test('joystick deadzone stops drift; diagonal and overshoot stay bounded', () => {
  assert.deepEqual(joystickVector(3, 3, 50), {x:0,y:0});
  const a=joystickVector(100,-100,50);
  assert.ok(Math.abs(Math.hypot(a.x,a.y)-1)<1e-9);
  assert.ok(a.x>0&&a.y>0);
  assert.ok(Math.hypot(...Object.values(joystickVector(25,0,50)))<1);
});
test('partial joystick travel produces proportional walking speed', () => {
  const a=new Combat(),b=new Combat();a.start();b.start();
  const start={...a.player};
  for(let i=0;i<12;i++){a.update(1/120,{x:1,z:0});b.update(1/120,{x:.5,z:0});}
  assert.ok(Math.abs(dist(a.player,start)/dist(b.player,start)-2)<1e-9);
});
test('aim selects the nearest living target and bounds attack correction', () => {
  const p={x:0,z:0}, enemies=[{x:-1,z:0,hp:0},{x:10,z:0,hp:10},{x:1,z:0,hp:10}];
  assert.ok(Math.abs(assistedAim(0,p,enemies,1/60)-7/60)<1e-9);
  assert.ok(Math.abs(assistedAim(0,p,enemies,1/60,true)-Math.PI/9)<1e-9);
  assert.equal(assistedAim(.7,p,[{x:1,z:1,hp:0}],.1),.7);
});
test('aim takes the short turn across the angle boundary', () => {
  const a=assistedAim(Math.PI-.05,{x:0,z:0},[{x:-.1,z:-2,hp:1}],.01);
  assert.ok(a<0);
});
test('Pages paths support project repos, user sites and configured custom domains', () => {
  assert.equal(pagesBase(),'/archipelago-game/');
  assert.equal(pagesBase({repository:'someone/new-repo'}),'/new-repo/');
  assert.equal(pagesBase({repository:'someone/someone.github.io'}),'/');
  assert.equal(pagesBase({basePath:'/custom/'}),'/custom/');
  assert.equal(pagesBase({basePath:'/'}),'/');
});
test('mobile rendering bounds resolution and reduces work on low-end devices', () => {
  const normal=chooseQuality({touch:true,memory:8,cores:8});
  const low=chooseQuality({touch:true,memory:2,cores:4});
  assert.ok(normal.shadowSize<=1024);assert.ok(low.particleLimit<normal.particleLimit);
  assert.ok(renderRatio(normal,844,390,3)<=1.25);
  assert.ok(renderRatio(normal,3840,2160,3)**2*3840*2160<=normal.pixelBudget+1);
  assert.ok(renderRatio(low,844,390,3,.6)<renderRatio(low,844,390,3));
});
