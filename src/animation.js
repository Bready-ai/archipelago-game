import * as THREE from 'three';
import { C } from './combat.js';
import { GROUND_Y,HAMMER_SHAFT,HAMMER_SOLE } from './actors.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
function interpolate(a,b,t){const result={};for(const key of Object.keys(a))result[key]=Array.isArray(a[key])?a[key].map((v,i)=>mix(v,b[key][i],t)):mix(a[key],b[key],t);return result;}
function track(t,frames){
  if(t<=frames[0][0])return interpolate(frames[0][1],frames[0][1],0);
  for(let i=1;i<frames.length;i++)if(t<=frames[i][0]){let u=clamp((t-frames[i-1][0])/(frames[i][0]-frames[i-1][0]));u=frames[i][2]==='accelerate'?u*u:smooth(u);return interpolate(frames[i-1][1],frames[i][1],u);}
  const last=frames.at(-1)[1];return interpolate(last,last,0);
}
const FOX_GUARD={pelvis:[0,.72,0],hipYaw:.03,chestYaw:-.13,chestPitch:.08,chestRoll:0,headPitch:-.04,
  rightHand:[-.37,1.11,.30],leftHand:[.30,1.20,.26],swordYaw:-.28,swordPitch:-.12,swordRoll:.05};
const foxPose=(extra)=>({...FOX_GUARD,...extra});
const FOX_ATTACK=[
  [0,FOX_GUARD],
  [.085,foxPose({pelvis:[-.045,.69,-.035],hipYaw:-.15,chestYaw:-.52,chestPitch:.02,rightHand:[-.50,1.26,-.07],leftHand:[.27,1.26,.18],swordYaw:-1.36,swordPitch:-.18,swordRoll:-.20})],
  [C.attackWindup,foxPose({pelvis:[.015,.70,.07],hipYaw:.16,chestYaw:.16,chestPitch:.17,rightHand:[-.08,1.15,.49],leftHand:[.37,1.18,.08],swordYaw:0,swordPitch:-.06,swordRoll:.10}),'accelerate'],
  [C.attackWindup+C.attackActive,foxPose({pelvis:[.06,.68,.055],hipYaw:.26,chestYaw:.56,chestPitch:.13,rightHand:[.30,1.01,.27],leftHand:[.28,1.26,.03],swordYaw:1.24,swordPitch:.10,swordRoll:.32})],
  [.39,foxPose({pelvis:[.035,.70,.015],hipYaw:.13,chestYaw:.32,chestPitch:.10,rightHand:[.22,1.02,.16],swordYaw:1.0,swordPitch:.03})],
  [C.attackDuration,FOX_GUARD],
];
const ROBOT_GUARD={pelvis:[0,1.17,0],hipYaw:0,chestYaw:0,chestPitch:.025,chestRoll:0,headPitch:0,
  hammerHead:[-.91,1.40,1.25],hammerPitch:.22,headTilt:.10,leftHand:[.95,1.40,.3]};
const robotPose=extra=>({...ROBOT_GUARD,...extra});
// Head targets and shaft pitch are authored together: the wrist stays inside the
// arm's reach while the head clears the right shoulder before crossing overhead.
const ROBOT_IMPACT=robotPose({pelvis:[-.025,1.04,.12],hipYaw:.035,chestYaw:.04,chestPitch:.28,chestRoll:-.035,headPitch:-.13,hammerHead:[0,GROUND_Y+HAMMER_SOLE,2.4],hammerPitch:.55,headTilt:0,leftHand:[1.05,1.45,.6]});
const ROBOT_APEX=robotPose({pelvis:[-.055,1.14,-.055],hipYaw:-.07,chestYaw:-.10,chestPitch:-.12,chestRoll:.025,headPitch:.08,hammerHead:[0,4,.03],hammerPitch:-.80,headTilt:-.45,leftHand:[.9,1.86,.62]});
const ROBOT_WINDUP=[
  [0,ROBOT_GUARD],
  [.20,robotPose({pelvis:[-.055,1.09,-.045],hipYaw:-.08,chestYaw:-.12,chestPitch:.02,chestRoll:.025,hammerHead:[-1.50,1.65,1.02],hammerPitch:-.25,headTilt:-.12,leftHand:[.98,1.48,.44]})],
  [.64,robotPose({pelvis:[-.06,1.12,-.065],hipYaw:-.10,chestYaw:-.15,chestPitch:-.10,chestRoll:.045,headPitch:.06,hammerHead:[-1.50,3.80,.26],hammerPitch:-.80,headTilt:-.40,leftHand:[.94,1.74,.54]})],
  [.88,ROBOT_APEX],
  [.94,ROBOT_APEX],
  [C.robotWindup,ROBOT_IMPACT,'accelerate'],
];
const ROBOT_RECOVERY=[
  [0,ROBOT_IMPACT],
  [.18,robotPose({...ROBOT_IMPACT,pelvis:[-.04,1.055,.10],chestPitch:.25})],
  // Break the head free slowly, then draw it back outside the body.
  [.66,robotPose({pelvis:[-.065,1.08,.04],hipYaw:-.06,chestYaw:-.09,chestPitch:.16,chestRoll:.035,headPitch:-.08,hammerHead:[-1.12,.78,2.03],hammerPitch:.36,headTilt:0,leftHand:[.98,1.42,.47]})],
  [1.28,robotPose({pelvis:[-.045,1.13,-.025],chestYaw:-.06,chestPitch:.08,hammerHead:[-1.05,1.18,1.48],hammerPitch:.26,headTilt:.08})],
  [C.robotRecovery,ROBOT_GUARD],
];
export function sampleFoxPose(state,t,contactYaw=0){
  const pose=state==='attack'?track(t,FOX_ATTACK):foxPose({pelvis:[...FOX_GUARD.pelvis],rightHand:[...FOX_GUARD.rightHand],leftHand:[...FOX_GUARD.leftHand]});
  if(state==='attack'&&contactYaw){
    const weight=t<=C.attackWindup?smooth((t-.085)/(C.attackWindup-.085)):1-smooth((t-C.attackWindup)/(C.attackDuration-C.attackWindup));
    const yaw=contactYaw*weight,c=Math.cos(yaw),s=Math.sin(yaw),[x,y,z]=pose.rightHand;
    pose.rightHand=[x*c+z*s,y,-x*s+z*c];pose.swordYaw+=yaw;pose.chestYaw+=yaw*.50;pose.hipYaw+=yaw*.25;
  }
  return pose;
}
export function sampleRobotPose(state,t){
  const pose=state==='windup'?track(t,ROBOT_WINDUP):state==='strike'?robotPose({...ROBOT_IMPACT,pelvis:[...ROBOT_IMPACT.pelvis]}):state==='recover'?track(t,ROBOT_RECOVERY):robotPose({pelvis:[...ROBOT_GUARD.pelvis]});
  if(state==='windup'&&t>.94){
    const u=clamp((t-.94)/(C.robotWindup-.94))**2,v=1-u;
    // An overhead arc accelerates forward, then down into the existing impact instant.
    pose.hammerPitch=mix(ROBOT_APEX.hammerPitch,ROBOT_IMPACT.hammerPitch,1-(1-u)**2);
    const points=[[0,4,.03],[0,4,1.20],[0,2.0,2.7],[0,GROUND_Y+HAMMER_SOLE,2.4]];
    pose.hammerHead=[0,1,2].map(i=>v**3*points[0][i]+3*v*v*u*points[1][i]+3*v*u*u*points[2][i]+u**3*points[3][i]);
  }
  return pose;
}
export function recoilEnvelope(age,strength=1){return age<0?0:Math.exp(-age*8)*Math.sin(age*19)*strength;}
export function localDirection(x,z,angle){const c=Math.cos(angle),s=Math.sin(angle);return{x:c*x-s*z,z:s*x+c*z};}

const DOWN=new THREE.Vector3(0,-1,0),UP=new THREE.Vector3(0,1,0);
const target=new THREE.Vector3(),pole=new THREE.Vector3(),direction=new THREE.Vector3(),bend=new THREE.Vector3(),elbow=new THREE.Vector3(),forearm=new THREE.Vector3();
const q=new THREE.Quaternion(),q2=new THREE.Quaternion(),euler=new THREE.Euler(0,0,0,'YXZ');
// Two bone analytic IK. The shoulder/hip owns the upper bone; the elbow/knee is its child.
function solveLimb(frame,limb,point,polePoint,stability=0){
  frame.localToWorld(target.fromArray(point));limb.upper.parent.worldToLocal(target);target.sub(limb.upper.position);
  frame.localToWorld(pole.fromArray(polePoint));limb.upper.parent.worldToLocal(pole);pole.sub(limb.upper.position);
  const d=clamp(target.length(),Math.abs(limb.l1-limb.l2)+.001,limb.l1+limb.l2-.001);
  direction.copy(target).normalize();target.copy(direction).multiplyScalar(d);
  bend.copy(pole).addScaledVector(direction,-pole.dot(direction));if(bend.lengthSq()<.0001)bend.set(0,0,1);bend.normalize();
  const a=(limb.l1**2-limb.l2**2+d*d)/(2*d),h=Math.sqrt(Math.max(0,limb.l1**2-a*a));
  elbow.copy(direction).multiplyScalar(a).addScaledVector(bend,h);
  limb.upper.quaternion.setFromUnitVectors(DOWN,forearm.copy(elbow).normalize());
  if(stability>0){
    // Align bone twist with the bend plane while the arm passes overhead;
    // shortest-arc orientation alone spins around an almost vertical upper arm.
    const x=new THREE.Vector3().crossVectors(direction,bend).negate().normalize();
    const y=elbow.clone().normalize().negate(),z=new THREE.Vector3().crossVectors(x,y).normalize();
    limb.upper.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z)),stability);
  }
  forearm.copy(target).sub(elbow).applyQuaternion(q.copy(limb.upper.quaternion).invert()).normalize();
  limb.lower.quaternion.setFromUnitVectors(DOWN,forearm);
  limb.upper.updateMatrixWorld(true);
}
function orient(frame,node,pitch=0,yaw=0,roll=0){
  frame.getWorldQuaternion(q);q.multiply(q2.setFromEuler(euler.set(pitch,yaw,roll,'YXZ')));
  node.parent.getWorldQuaternion(q2);node.quaternion.copy(q2.invert().multiply(q));node.updateMatrixWorld(true);
}
function reactionVector(reaction,angle){const d=localDirection(reaction.x,reaction.z,angle);const a=recoilEnvelope(reaction.age,reaction.strength);return{x:d.x*a,z:d.z*a,amount:a};}
function baseBody(rig,entity,pose,reaction,deathAge){
  rig.root.position.set(entity.x,0,entity.z);rig.root.rotation.y=entity.angle;rig.visual.position.set(0,0,0);rig.visual.rotation.set(0,0,0);
  const kick=reactionVector(reaction,entity.angle);
  rig.pelvis.position.fromArray(pose.pelvis);rig.pelvis.position.x+=kick.x;rig.pelvis.position.z+=kick.z;rig.pelvis.position.y-=Math.abs(kick.amount)*.15;
  rig.pelvis.rotation.set(0,pose.hipYaw,0);rig.spine.rotation.set(0,0,0);
  rig.chest.rotation.set(pose.chestPitch+kick.z*1.8,pose.chestYaw,pose.chestRoll-kick.x*1.7,'YXZ');
  rig.head.rotation.set(pose.headPitch-kick.z*.7,-pose.chestYaw*.55,kick.x*.35,'YXZ');
  if(entity.state==='dead'){const fall=smooth(deathAge/.65);rig.visual.rotation.z=-1.35*fall;rig.visual.position.y=-.05*fall;rig.pelvis.position.y-=.30*fall;}
  rig.root.updateMatrixWorld(true);return kick;
}
function feet(rig,entity,gait,robot=false){
  const movement=localDirection(gait.dx,gait.dz,entity.angle),amount=clamp(gait.speed/(robot?1.35:C.speed));
  const d=Math.hypot(movement.x,movement.z)||1,nx=movement.x/d,nz=movement.z/d;
  rig.legs.forEach((leg,i)=>{
    const cycle=gait.phase+i*Math.PI,travel=Math.sin(cycle)*(robot?.26:.21)*amount,lift=Math.max(0,Math.cos(cycle))*(robot?.10:.115)*amount;
    const x=(i===0?-1:1)*(robot?.53:.20)+nx*travel,z=(robot?.10:i===0?.15:-.12)+nz*travel;
    solveLimb(rig.visual,leg,[x,GROUND_Y+(robot?.13:.07)+lift,z],[x,.35,robot?.9:.7]);
    orient(rig.visual,leg.hand,0,amount*Math.atan2(nx,nz)*.12,0);
  });
}
export class ActorAnimator {
  constructor(rig,kind){this.rig=rig;this.kind=kind;this.reset({x:0,z:0});}
  reset(entity){this.plantedFeet=null;this.contactYaw=0;this.previous={x:entity.x,z:entity.z};this.gait={phase:0,dx:0,dz:0,speed:0};this.reaction={x:0,z:0,strength:0,age:10};}
  robotFeet(entity){
    const rig=this.rig;
    if(!this.plantedFeet){
      this.plantedFeet=rig.legs.map(leg=>({start:leg.hand.getWorldPosition(new THREE.Vector3()),end:new THREE.Vector3(),yaw:entity.angle}));
    }
    const preparing=entity.state==='windup'&&entity.t<.44;
    rig.legs.forEach((leg,i)=>{
      const foot=this.plantedFeet[i];
      if(preparing||foot.end.lengthSq()===0){
        // The short settling step follows the existing aim turn, then plants in
        // world space for the locked swing, contact and the entire recovery.
        foot.end.copy(rig.visual.localToWorld(new THREE.Vector3(i===0?-.56:.56,GROUND_Y+.13,i===0?.22:-.06)));
        foot.yaw=entity.angle;
      }
      const u=entity.state==='windup'?smooth(entity.t/.44):1;
      const world=foot.start.clone().lerp(foot.end,u);
      if(entity.state==='recover'){
        const settle=smooth((entity.t-1.28)/(C.robotRecovery-1.28));
        world.lerp(rig.visual.localToWorld(new THREE.Vector3(i===0?-.53:.53,GROUND_Y+.13,.10)),settle);
        world.y+=Math.sin(Math.PI*settle)*.045;
      }
      if(preparing)world.y+=Math.sin(Math.PI*u)*.075;
      const p=rig.visual.worldToLocal(world);
      solveLimb(rig.visual,leg,p.toArray(),[i===0?-.65:.65,.4,1]);
      orient(rig.visual,leg.hand,0,foot.yaw-entity.angle,0);
    });
  }
  aimStrike(yaw){this.contactYaw=clamp(yaw,-C.attackHalfAngle,C.attackHalfAngle);}
  hit(x,z,strength){const length=Math.hypot(x,z)||1;this.reaction={x:x/length,z:z/length,strength,age:0};}
  update(entity,{dt=0,clock=0,deathAge=0,contactHold=false,advanceRecoil=true}={}){
    const rig=this.rig,g=this.gait,dx=entity.x-this.previous.x,dz=entity.z-this.previous.z,d=Math.hypot(dx,dz);
    if(dt>0){if(advanceRecoil)this.reaction.age+=dt;g.phase+=Math.min(d,.7)*Math.PI*2/(this.kind==='fox'?.82:1.65);g.speed=mix(g.speed,d/dt,1-Math.exp(-dt*20));if(d>.0001){g.dx=dx/d;g.dz=dz/d;}}
    this.previous.x=entity.x;this.previous.z=entity.z;
    const t=contactHold&&entity.state==='attack'?C.attackWindup:entity.t;
    const pose=this.kind==='fox'?sampleFoxPose(entity.state,t,this.contactYaw):sampleRobotPose(entity.state,t);
    if(entity.state==='idle'||entity.state==='approach'){pose.pelvis[1]+=Math.sin(clock*2)*.009;if(g.speed>.1)pose.pelvis[1]+=Math.cos(g.phase*2)*.012;}
    if(this.kind==='fox'&&entity.state==='dodge'){pose.pelvis[1]-=Math.sin(entity.t/C.dodgeDuration*Math.PI)*.16;pose.chestPitch+=.35;}
    const kick=baseBody(rig,entity,pose,this.reaction,deathAge);
    if(this.kind==='robot'&&['windup','strike','recover'].includes(entity.state))this.robotFeet(entity);
    else {this.plantedFeet=null;feet(rig,entity,g,this.kind==='robot');}
    if(this.kind==='fox'){
      const rh=pose.rightHand.map((v,i)=>v+(i===0?kick.x*.6:i===2?kick.z*.6:0));
      solveLimb(rig.visual,rig.right,rh,[-.85,.95,.1]);solveLimb(rig.visual,rig.left,pose.leftHand,[.8,.95,.1]);
      orient(rig.visual,rig.right.hand,pose.swordPitch,pose.swordYaw,pose.swordRoll);orient(rig.visual,rig.left.hand,0,0,0);
      rig.tail.rotation.y=-pose.chestYaw*.45+Math.sin(clock*3)*.06;rig.tail.rotation.x=kick.z*.5;rig.scarf.rotation.x=-pose.chestPitch*.5;
    }else{
      const pitch=pose.hammerPitch,head=pose.hammerHead;
      const hand=[head[0],head[1]+Math.sin(pitch)*HAMMER_SHAFT,head[2]-Math.cos(pitch)*HAMMER_SHAFT];
      const poleWeight=entity.state==='windup'?smooth(t/.20):entity.state==='strike'?1:entity.state==='recover'?1-smooth((t-1.28)/(C.robotRecovery-1.28)):0;
      const armPole=[mix(-1.6,-2.4,poleWeight),mix(1.8,2.5,poleWeight),mix(.3,-.2,poleWeight)];
      solveLimb(rig.visual,rig.right,hand,armPole,poleWeight);orient(rig.visual,rig.right.hand,pitch,0,0);
      orient(rig.visual,rig.hammerHead,pose.headTilt,0,0);
      solveLimb(rig.visual,rig.left,pose.leftHand,[1.5,1.6,.35]);orient(rig.visual,rig.left.hand,0,0,0);
    }
    rig.root.updateMatrixWorld(true);
  }
}
