import test from 'node:test';
import assert from 'node:assert/strict';
import {Combat,C,dist,sectorHits,wrap} from '../src/combat.js';
const tick=(g,seconds,input={})=>{for(let t=0;t<seconds;t+=1/120)g.update(1/120,input)};
function fixture(){const events=[];const g=new Combat((type,data)=>events.push({type,data}));g.start();g.player.x=0;g.player.z=2.5;g.player.angle=Math.PI;g.robot.x=0;g.robot.z=0;g.robot.angle=0;g.robot.cd=100;return{g,events};}
test('range and facing distinguish hits, misses, and target edges',()=>{
 assert.equal(sectorHits({x:0,z:0},0,2,.7,{x:0,z:2.3},.4),true);
 assert.equal(sectorHits({x:0,z:0},0,2,.7,{x:0,z:2.5},.4),false);
 assert.equal(sectorHits({x:0,z:0},0,2,.7,{x:0,z:-1},.4),false);
 assert.equal(sectorHits({x:0,z:0},0,2,.7,{x:1.5,z:1.5},.4),true);
});
test('diagonal motion has the same speed as straight motion',()=>{
 const a=fixture().g,b=fixture().g;tick(a,.2,{x:1,z:0});tick(b,.2,{x:1,z:1});
 assert.ok(Math.abs(dist(a.player,{x:0,z:2.5})-dist(b.player,{x:0,z:2.5}))<1e-9);
});
test('a sword swing deals damage once; a distant swing misses',()=>{
 const {g,events}=fixture();g.update(1/120,{attack:true,angle:Math.PI});tick(g,.7,{angle:Math.PI});assert.equal(g.robot.hp,162);assert.equal(events.filter(e=>e.type==='robot-hit').length,1);
 g.player.z=5;g.update(1/120,{attack:true,angle:Math.PI});tick(g,.7);assert.equal(g.robot.hp,162);assert.equal(g.misses,1);
});
test('recovery exposes the robot to higher damage',()=>{
 const {g}=fixture();g.robot.state='recover';g.robot.t=0;g.update(1/120,{attack:true,angle:Math.PI});tick(g,.3);assert.equal(g.robot.hp,150);
});
test('bodies stay separated even during a dodge through the target',()=>{
 const {g}=fixture();g.update(1/120,{dodge:true,x:0,z:-1});for(let i=0;i<60;i++){g.update(1/120,{x:0,z:-1});assert.ok(dist(g.player,g.robot)>=C.playerRadius+C.robotRadius-1e-9);}
 assert.ok(g.player.z>0);
});
test('robot locks its telegraphed direction before impact',()=>{
 const {g}=fixture();g.robot.cd=0;tick(g,.55);assert.equal(g.robot.state,'windup');assert.equal(g.robot.locked,true);const angle=g.robot.angle;g.player.x=4;g.player.z=0;tick(g,.35);assert.equal(g.robot.angle,angle);
});
test('heavy attack damages once, and dodge timing avoids it',()=>{
 const a=fixture().g;a.robot.state='strike';a.robot.t=0;tick(a,.23);assert.equal(a.player.hp,66);
 const b=fixture().g;b.robot.state='strike';b.robot.t=0;b.player.state='dodge';b.player.t=.05;b.player.dx=1;b.player.dz=0;tick(b,.23);assert.equal(b.player.hp,100);
});
test('death stops combat and restarting clears the encounter',()=>{
 const {g}=fixture();g.player.hp=10;g.robot.state='strike';tick(g,.1);assert.equal(g.mode,'lost');tick(g,2,{attack:true});assert.equal(g.robot.hp,180);g.start();assert.equal(g.mode,'playing');assert.equal(g.player.hp,100);assert.equal(g.robot.hp,180);assert.equal(g.hits,0);
});
test('a distance-based strategy can defeat the robot without taking damage',()=>{
 const g=new Combat();g.start();
 for(let i=0;i<120*80&&g.mode==='playing';i++){
  const p=g.player,r=g.robot,d=dist(p,r),a=Math.atan2(r.x-p.x,r.z-p.z);let move=0,attack=false;
  if(r.state==='recover'&&r.t<1.15){move=d>2.4?1:0;attack=d<2.65;}
  else if(r.state==='windup'||r.state==='strike'||r.state==='recover'){move=d<4.1?-1:0;}
  else{move=d>3.2?1:d<3.1?-1:0;}
  g.update(1/120,{x:Math.sin(a)*move,z:Math.cos(a)*move,angle:a,attack});
 }
 assert.equal(g.mode,'won');assert.equal(g.player.hp,100);assert.ok(g.hits>=6);
});
