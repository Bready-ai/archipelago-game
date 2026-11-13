import * as THREE from 'three';
import { C } from './combat.js';
import { GROUND_Y } from './actors.js';

export class ContactEffects {
  constructor(scene,quality,geometries,sectorGeometry){
    this.scene=scene;this.quality=quality;this.geometries=geometries;this.particles=[];this.history=[];this.lastTrailTime=-1;
    this.wave=new THREE.Mesh(sectorGeometry(C.robotRange-.055,C.robotRange,C.robotHalfAngle),new THREE.MeshBasicMaterial({color:'#e0b785',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
    this.wave.position.y=GROUND_Y+.035;this.wave.visible=false;scene.add(this.wave);this.waveAge=1;
    this.trailPositions=new Float32Array(9*18);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.trailPositions,3));g.setDrawRange(0,0);
    this.trail=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:'#e9f2c9',transparent:true,opacity:.36,side:THREE.DoubleSide,depthWrite:false}));this.trail.frustumCulled=false;this.trail.visible=false;scene.add(this.trail);
    this.tip=new THREE.Vector3();this.base=new THREE.Vector3();
  }
  resetTrail(){this.history.length=0;this.lastTrailTime=-1;this.trail.visible=false;}
  reset(){for(const p of this.particles){this.scene.remove(p.mesh);p.mesh.material.dispose();}this.particles.length=0;this.wave.visible=false;this.resetTrail();}
  burst(point,color,count=12,power=1,direction={x:0,z:0},dust=false){
    count=Math.min(Math.ceil(count*(this.quality.low?.45:this.quality.touch?.7:1)),this.quality.particleLimit-this.particles.length);
    for(let i=0;i<count;i++){
      const mesh=new THREE.Mesh(dust?this.geometries.sphere:this.geometries.box,new THREE.MeshBasicMaterial({color,transparent:true,opacity:dust?.30:1,depthWrite:false}));
      mesh.position.copy(point);const size=dust?.045+Math.random()*.04:.025+Math.random()*.02;mesh.scale.set(size,dust?size:.018,dust?size:size*2.5);
      const vx=(Math.random()-.5)*3.4*power+direction.x*power,vz=(Math.random()-.5)*3.4*power+direction.z*power;
      this.scene.add(mesh);this.particles.push({mesh,vx,vz,vy:dust?.35+Math.random()*.8:1+Math.random()*2.7,t:0,life:dust?.24+Math.random()*.18:.14+Math.random()*.24,dust});
    }
  }
  slam(origin,angle,point){
    this.waveAge=0;this.wave.position.set(origin.x,GROUND_Y+.035,origin.z);this.wave.rotation.y=angle;this.wave.visible=true;
    this.burst(point,'#c5b28b',14,.8,{x:Math.sin(angle),z:Math.cos(angle)},true);
    this.burst(point,'#f0d49a',5,.8,{x:0,z:0});
  }
  update(dt,{fox,player,clock}){
    if(this.wave.visible){this.waveAge+=dt;const u=Math.min(1,this.waveAge/C.robotActive);this.wave.scale.setScalar(.25+.75*Math.sqrt(u));this.wave.material.opacity=(1-u)*.42;if(u>=1)this.wave.visible=false;}
    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];p.t+=dt;p.mesh.position.x+=p.vx*dt;p.mesh.position.z+=p.vz*dt;p.mesh.position.y+=p.vy*dt;p.vy-=dt*(p.dust?3.5:10);
      p.mesh.position.y=Math.max(GROUND_Y+.012,p.mesh.position.y);p.mesh.rotation.y+=dt*5;
      p.mesh.material.opacity=(p.dust?.3:1)*(1-p.t/p.life);if(p.dust)p.mesh.scale.multiplyScalar(1+dt*2);
      if(p.t>=p.life){this.scene.remove(p.mesh);p.mesh.material.dispose();this.particles.splice(i,1);}
    }
    const active=player.state==='attack'&&player.t>=.095&&player.t<=.30;
    if(active&&clock!==this.lastTrailTime){
      fox.tip.getWorldPosition(this.tip);fox.sword.localToWorld(this.base.set(0,0,.20));
      this.history.push({tip:this.tip.toArray(),base:this.base.toArray()});if(this.history.length>10)this.history.shift();this.lastTrailTime=clock;
      let n=0;for(let i=1;i<this.history.length;i++){
        const a=this.history[i-1],b=this.history[i];for(const v of [a.base,a.tip,b.tip,a.base,b.tip,b.base])for(const x of v)this.trailPositions[n++]=x;
      }
      this.trail.geometry.attributes.position.needsUpdate=true;this.trail.geometry.setDrawRange(0,n/3);
    }
    this.trail.visible=player.state==='attack'&&player.t<=.34&&this.history.length>1;
    this.trail.material.opacity=player.t<.25?.30:Math.max(0,(.34-player.t)/.09)*.30;
  }
}
