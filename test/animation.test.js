import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createActors,GROUND_Y,HAMMER_SHAFT} from '../src/actors.js';
import {ActorAnimator,sampleRobotPose,recoilEnvelope,localDirection} from '../src/animation.js';
import {Combat,C} from '../src/combat.js';

const names=['coat','coatDark','cream','fox','fur','black','dark','red','boot','paint','metal','rust','eye'];
const materials=Object.fromEntries(names.map(name=>[name,new THREE.MeshStandardMaterial()]));
const geometries={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,10,8),cyl:new THREE.CylinderGeometry(1,1,1,12),cone:new THREE.ConeGeometry(1,1,4)};
function setup(kind){const rig=createActors({materials,geometries})[kind],anim=new ActorAnimator(rig,kind);return{rig,anim};}
const point=node=>node.getWorldPosition(new THREE.Vector3());
const local=(rig,node)=>rig.root.worldToLocal(point(node));
const close=(a,b,tolerance=.0001)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('sword belongs to anatomical right hand for every facing direction',()=>{
 const {rig,anim}=setup('fox');assert.equal(rig.sword.parent,rig.right.hand);
 for(const angle of [0,.7,Math.PI,-Math.PI/2]){anim.update({x:2,z:-3,angle,state:'idle',t:0});assert.ok(local(rig,rig.right.upper).x<0);assert.ok(local(rig,rig.left.upper).x>0);}
});
test('sword makes a broad arc and reaches the attack range at the existing contact time',()=>{
 for(const angle of [0,.7,Math.PI,-Math.PI/2]){
  const {rig,anim}=setup('fox'),entity={x:2,z:-3,angle,state:'attack',t:.085};
  anim.update(entity);const before=local(rig,rig.tip),coil=rig.chest.rotation.y;
  entity.t=C.attackWindup;anim.update(entity);const contact=local(rig,rig.tip);
  entity.t=C.attackWindup+C.attackActive;anim.update(entity);const after=local(rig,rig.tip);
  assert.ok(before.x<-1.5);assert.ok(after.x>1.3);close(contact.z,C.attackRange,.015);assert.ok(Math.abs(contact.x)<.10);
  assert.ok(coil<-.4&&rig.chest.rotation.y>.4,'the shoulders must turn with the sword');
 }
});
test('hammer reaches the ground at strike start and throughout the real damage window',()=>{
 for(const angle of [0,.7,Math.PI,-Math.PI/2]){
  const {rig,anim}=setup('robot'),entity={x:2,z:-3,angle,state:'windup',t:C.robotWindup};
  for(const [state,t] of [['windup',C.robotWindup],['strike',0],['strike',.12],['strike',C.robotActive-.001]]){
   Object.assign(entity,{state,t});anim.update(entity);
   close(point(rig.sole).y,GROUND_Y);close(new THREE.Box3().setFromObject(rig.hammerHead).min.y,GROUND_Y);
   const head=local(rig,rig.hammerHead);close(head.x,0);close(head.z,2.4);
  }
 }
});
test('windup rises overhead, descends in an arc, and recovery returns to guard',()=>{
 const {rig,anim}=setup('robot'),entity={x:0,z:0,angle:0,state:'windup',t:.94};anim.update(entity);assert.ok(point(rig.hammerHead).y>3.9);
 let previous=Infinity;
 for(let t=.95;t<=C.robotWindup;t+=.01){entity.t=t;anim.update(entity);const p=point(rig.hammerHead),expected=sampleRobotPose('windup',t).hammerHead;assert.ok(p.y<previous);previous=p.y;close(p.x,expected[0],.005);close(p.y,expected[1],.005);close(p.z,expected[2],.005);}
 entity.state='recover';entity.t=C.robotRecovery;anim.update(entity);const recovered=point(rig.hammerHead);
 entity.state='approach';entity.t=0;anim.update(entity);assert.ok(recovered.distanceTo(point(rig.hammerHead))<.001);
});
test('directional gait follows forward, backward and lateral movement without moving the game entity',()=>{
 for(const [dx,dz,angle] of [[0,.06,0],[0,-.06,0],[.06,0,0],[0,.06,Math.PI/2]]){
  const {rig,anim}=setup('fox'),entity={x:0,z:0,angle,state:'idle',t:0};anim.reset(entity);anim.update(entity,{dt:1/60});const start=local(rig,rig.legs[0].hand);
  entity.x=dx;entity.z=dz;anim.update(entity,{dt:1/60});const end=local(rig,rig.legs[0].hand),d=localDirection(dx,dz,angle);
  assert.ok((end.x-start.x)*d.x+(end.z-start.z)*d.z>0);assert.ok(end.y>=GROUND_Y+.07);close(entity.x,dx);close(entity.z,dz);
 }
});
test('hit recoil follows incoming direction, decays, and never changes the robot attack state',()=>{
 const {rig,anim}=setup('robot'),entity={x:0,z:0,angle:.7,state:'windup',t:.8};anim.update(entity);const before=point(rig.pelvis);
 anim.hit(1,0,.22);anim.update(entity,{dt:.06});const displacement=point(rig.pelvis).sub(before);
 assert.ok(displacement.x>.03);assert.ok(Math.abs(displacement.z)<.001);assert.equal(entity.state,'windup');assert.equal(entity.t,.8);
 assert.ok(Math.abs(recoilEnvelope(.7,.22))<.001);
});
test('hitstop freezes both pose and reaction at the actual sword contact',()=>{
 const {rig,anim}=setup('fox'),entity={x:0,z:0,angle:1.2,state:'attack',t:C.attackWindup+.007};anim.hit(0,1,.38);
 anim.update(entity,{dt:0,contactHold:true,advanceRecoil:false});const first=point(rig.tip);
 for(let i=0;i<6;i++)anim.update(entity,{dt:0,contactHold:true,advanceRecoil:false});
 assert.ok(first.distanceTo(point(rig.tip))<1e-8);assert.equal(anim.reaction.age,0);
});
test('robot visual contact matches the existing slam and damage events',()=>{
 let g;const events=[];g=new Combat((type)=>{if(type==='slam'||type==='player-hit')events.push({type,state:g.robot.state,t:g.robot.t,head:sampleRobotPose(g.robot.state,g.robot.t).hammerHead});});g.start();g.player.x=0;g.player.z=2.5;g.robot.x=g.robot.z=0;g.robot.angle=0;g.robot.cd=0;
 for(let i=0;i<180;i++)g.update(1/120,{});
 assert.deepEqual(events.map(e=>e.type),['slam','player-hit']);for(const e of events){assert.equal(e.state,'strike');close(e.head[1]-.355,GROUND_Y);}
});

test('visual contact can follow a hit near either side of the unchanged attack sector',()=>{
 for(const offset of [-.9,.9]){
  const {rig,anim}=setup('fox'),entity={x:0,z:0,angle:0,state:'attack',t:C.attackWindup};anim.aimStrike(offset);anim.update(entity,{contactHold:true});
  const tip=local(rig,rig.tip);close(Math.atan2(tip.x,tip.z),offset-Math.atan2(.08,1.848),.02);close(Math.hypot(tip.x,tip.z),C.attackRange,.02);
 }
});

// Sample the actual hierarchy densely, rather than checking only authored keys.
test('PR-7 wrist tracks the shaft arc without IK reach clipping or body intersections',async()=>{
 const {OBB}=await import('three/addons/math/OBB.js');
 const box=(size,matrix)=>new OBB(new THREE.Vector3(),new THREE.Vector3(...size).multiplyScalar(.5)).applyMatrix4(matrix);
 for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const {rig,anim}=setup('robot'),entity={x:2,z:-3,angle,state:'approach',t:0};anim.reset(entity);anim.update(entity);
  let previous=null;
  for(const [state,duration] of [['windup',C.robotWindup],['strike',C.robotActive],['recover',C.robotRecovery]]){
   for(let i=0;i<=Math.ceil(duration*240);i++){
    const t=Math.min(i/240,duration);Object.assign(entity,{state,t});anim.update(entity,{dt:1/240});
    const pose=sampleRobotPose(state,t),head=local(rig,rig.hammerHead);
    assert.ok(head.distanceTo(new THREE.Vector3(...pose.hammerHead))<1e-6,`${state} ${t}: unreachable wrist`);
    const hammer=box([1.25,.71,.95],rig.hammerHead.matrixWorld);
    assert.ok(!hammer.intersectsOBB(box([1.5,1.13,.92],rig.chest.matrixWorld)),`${state} ${t}: hammer in torso`);
    assert.ok(!hammer.intersectsOBB(box([.91,.45,.68],rig.head.matrixWorld)),`${state} ${t}: hammer in skull`);
    for(let z=0;z<HAMMER_SHAFT;z+=.06){
     const p=rig.chest.worldToLocal(rig.hammer.localToWorld(new THREE.Vector3(0,0,z)));
     assert.ok(!(Math.abs(p.x)<.82&&p.y>-.56&&p.y<.7&&Math.abs(p.z)<.53),`${state} ${t}: handle in torso`);
    }
    const joints=[rig.right.upper,rig.right.lower,rig.left.upper,rig.left.lower,...rig.legs.flatMap(l=>[l.upper,l.lower])].map(n=>n.quaternion.clone());
    if(previous)joints.forEach((q,i)=>assert.ok(q.angleTo(previous[i])<(state==='windup'&&t>=.94?.25:.15),`${state} ${t}: joint ${i} jumps`));
    previous=joints;
   }
  }
 }
});

test('PR-7 plants its feet after aiming and holds them through contact and loaded recovery',()=>{
 for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const {rig,anim}=setup('robot'),entity={x:2,z:-3,angle,state:'approach',t:0};anim.reset(entity);anim.update(entity);
  let planted;
  for(const [state,duration] of [['windup',C.robotWindup],['strike',C.robotActive],['recover',C.robotRecovery]])for(let i=0;i<=Math.ceil(duration*120);i++){
   const t=Math.min(i/120,duration);Object.assign(entity,{state,t});anim.update(entity,{dt:1/120});
   if(state==='windup'&&t>=.44&&!planted)planted=rig.legs.map(l=>point(l.hand));
   if(planted&&(state!=='recover'||t<=1.28))rig.legs.forEach((l,j)=>assert.ok(point(l.hand).distanceTo(planted[j])<1e-6,`${state} ${t}: sliding foot`));
  }
  const end=rig.legs.map(l=>point(l.hand));entity.state='approach';entity.t=0;anim.update(entity,{dt:1/120});
  rig.legs.forEach((l,j)=>assert.ok(point(l.hand).distanceTo(end[j])<1e-6,'recovery foot pop'));
 }
});
