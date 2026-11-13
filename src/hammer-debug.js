import * as THREE from 'three';
import {ActorAnimator} from './animation.js';
import {C} from './combat.js';

// Opt-in visual rehearsal. It never advances Combat or changes its constants.
export function createHammerDebug(scene,rig){
  if(new URLSearchParams(location.search).get('hammerDebug')!=='1')return null;
  const duration=C.robotWindup+C.robotActive+C.robotRecovery;
  const animator=new ActorAnimator(rig,'robot'),entity={x:0,z:0,angle:0,state:'windup',t:0};
  let time=0,playing=true,reseed=true;
  const panel=document.createElement('aside');panel.className='hammer-debug';
  panel.innerHTML=`<b>ПР-7 · проверка удара</b><label><input data-play type="checkbox" checked> Воспроизведение · 25%</label>
    <label>Направление <select aria-label="Направление робота"><option value="0">0°</option><option value="1.5707963267948966">90°</option><option value="3.141592653589793">180°</option><option value="-1.5707963267948966">270°</option></select></label>
    <label><input data-joints type="checkbox" checked> Суставы</label><label><input data-path type="checkbox" checked> Траектория головки</label>
    <input data-time aria-label="Фаза удара" type="range" min="0" max="${duration}" step="0.001" value="0"><output></output><a href="${location.pathname}">Вернуться в игру · отключить отладку</a>`;
  document.body.append(panel);document.documentElement.classList.add('hammer-debug-mode');
  const slider=panel.querySelector('[data-time]'),output=panel.querySelector('output');
  panel.querySelector('[data-play]').onchange=e=>playing=e.target.checked;
  slider.oninput=()=>{reseed=true;time=Number(slider.value);playing=false;panel.querySelector('[data-play]').checked=false;};
  panel.querySelector('select').onchange=e=>{entity.angle=Number(e.target.value);reseed=true;};
  const nodes=[rig.pelvis,rig.chest,rig.head,...[rig.right,rig.left,...rig.legs].flatMap(l=>[l.upper,l.lower,l.hand])];
  const overlay=new THREE.Group();scene.add(overlay);
  const material=new THREE.MeshBasicMaterial({color:'#71f7ed',depthTest:false});
  const markers=nodes.map(()=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),material);m.renderOrder=20;overlay.add(m);return m;});
  const geometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:300},()=>new THREE.Vector3()));
  const path=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#ffcd75',depthTest:false}));path.renderOrder=19;scene.add(path);
  const positions=geometry.attributes.position;let count=0,previous=-1,previousAngle=0;
  return {
    update(dt){
      if(playing)time=(time+dt*.25)%duration;
      if(time<previous||entity.angle!==previousAngle)reseed=true;
      if(reseed){
        count=0;animator.reset(entity);
        animator.update({...entity,state:'approach',t:0});
        // Recreate the planted stance deterministically when scrubbing or turning.
        animator.update({...entity,state:'windup',t:0});
        animator.update({...entity,state:'windup',t:.44});
        reseed=false;
      }
      previous=time;previousAngle=entity.angle;
      entity.state=time<C.robotWindup?'windup':time<C.robotWindup+C.robotActive?'strike':'recover';
      entity.t=time-(entity.state==='windup'?0:entity.state==='strike'?C.robotWindup:C.robotWindup+C.robotActive);
      animator.update(entity,{dt:playing?dt*.25:0});
      markers.forEach((m,i)=>nodes[i].getWorldPosition(m.position));
      const head=rig.hammerHead.getWorldPosition(new THREE.Vector3());
      if(count===0||head.distanceTo(new THREE.Vector3().fromBufferAttribute(positions,count-1))>.025){
        if(count===positions.count){positions.array.copyWithin(0,3);count--;}
        positions.setXYZ(count++,head.x,head.y,head.z);positions.needsUpdate=true;geometry.setDrawRange(0,count);geometry.computeBoundingSphere();
      }
      overlay.visible=panel.querySelector('[data-joints]').checked;path.visible=panel.querySelector('[data-path]').checked;
      slider.value=time;output.textContent=`${entity.state} · ${entity.t.toFixed(3)} с / ${(time).toFixed(3)} с`;
    },
    snapshot:()=>({time,state:entity.state,t:entity.t,angle:entity.angle,playing,speed:.25,points:count,joints:overlay.visible,path:path.visible}),
  };
}
