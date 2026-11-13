// All combat uses metres on the ground plane. Render rate never changes attack timings.
export const C = Object.freeze({
  playerRadius: .38, robotRadius: .88, speed: 4.25,
  attackRange: 1.85, attackHalfAngle: .95, attackWindup: .16, attackActive: .12, attackDuration: .62,
  dodgeDuration: .32, dodgeSpeed: 9.2, dodgeCooldown: .9,
  robotRange: 3.1, robotHalfAngle: .73, robotWindup: 1.16, robotActive: .25, robotRecovery: 1.8,
});
export const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
export const dist = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export function sectorHits(origin, angle, range, halfAngle, target, radius) {
  const dx=target.x-origin.x, dz=target.z-origin.z, d=Math.hypot(dx,dz);
  if(d>range+radius)return false;
  const offset=Math.abs(wrap(Math.atan2(dx,dz)-angle));
  if(offset<=halfAngle)return true;
  // Distance to the finite boundary segment, including the circular target's radius.
  const excess=offset-halfAngle, along=Math.max(0,Math.min(range,d*Math.cos(excess)));
  return d*d+along*along-2*d*along*Math.cos(excess)<=radius*radius;
}
export class Combat {
  constructor(emit=()=>{}) { this.emit=emit; this.reset(false); }
  reset(play=true) {
    this.mode=play?'playing':'intro'; this.time=0;this.hits=0;this.misses=0;this.dodges=0;this.elapsed=0;
    this.player={x:-2.4,z:2.6,angle:2.45,hp:100,state:'idle',t:0,cd:0,inv:0,hit:false,dx:0,dz:0,attackAngle:0};
    this.robot={x:1.3,z:-.9,angle:-.7,hp:180,state:'approach',t:0,cd:.9,hit:false,locked:false};
    this.attackBuffer=0; this.dodgeBuffer=0;this.obstacles=[{x:-7.5,z:-3.4,r:1.45},{x:7.3,z:2.4,r:1},{x:6.9,z:-4.5,r:1.1},{x:-6.8,z:4.5,r:.85}];
    this.emit('reset');
  }
  start(){this.reset(true)}
  pause(){if(this.mode==='playing')this.mode='paused';else if(this.mode==='paused')this.mode='playing'}
  move(entity,dx,dz,radius) {
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
    for(let i=0;i<steps;i++) {
      entity.x=Math.max(-8.1+radius,Math.min(8.1-radius,entity.x+dx/steps));
      entity.z=Math.max(-5.9+radius,Math.min(5.9-radius,entity.z+dz/steps));
      for(const o of this.obstacles) {
        const d=dist(entity,o),min=radius+o.r;
        if(d<min){const a=Math.atan2(entity.x-o.x,entity.z-o.z);entity.x=o.x+Math.sin(a)*min;entity.z=o.z+Math.cos(a)*min;}
      }
      const other=entity===this.player?this.robot:this.player;
      if(other.hp>0) {
        const d=dist(entity,other),min=C.playerRadius+C.robotRadius;
        if(d<min){const a=d>.0001?Math.atan2(entity.x-other.x,entity.z-other.z):entity.angle+Math.PI;entity.x=other.x+Math.sin(a)*min;entity.z=other.z+Math.cos(a)*min;}
      }
    }
  }
  update(dt,input={}) {
    if(this.mode!=='playing')return;
    this.time+=dt;this.elapsed+=dt;
    const p=this.player,r=this.robot;
    p.inv=Math.max(0,p.inv-dt);p.cd=Math.max(0,p.cd-dt);r.cd=Math.max(0,r.cd-dt);
    this.attackBuffer=Math.max(0,this.attackBuffer-dt);this.dodgeBuffer=Math.max(0,this.dodgeBuffer-dt);
    if(input.attack)this.attackBuffer=.14;
    if(input.dodge)this.dodgeBuffer=.14;
    const mx=input.x||0,mz=input.z||0,ml=Math.hypot(mx,mz),nx=ml?mx/ml:0,nz=ml?mz/ml:0;
    if(p.state!=='attack'&&p.state!=='dodge'&&Number.isFinite(input.angle))p.angle=input.angle;
    if(this.dodgeBuffer>0&&p.cd<=0&&(p.state==='idle'||p.state==='attack'&&p.t>=.28)) {
      p.state='dodge';p.t=0;p.cd=C.dodgeCooldown;p.dx=ml?nx:Math.sin(p.angle);p.dz=ml?nz:Math.cos(p.angle);
      this.dodgeBuffer=0;this.attackBuffer=0;this.dodges++;this.emit('dodge',p);
    } else if(this.attackBuffer>0&&p.state==='idle') {
      p.state='attack';p.t=0;p.hit=false;p.attackAngle=Number.isFinite(input.angle)?input.angle:p.angle;p.angle=p.attackAngle;
      this.attackBuffer=0;this.emit('swing',p);
    }
    p.t+=dt;
    if(p.state==='dodge') {
      this.move(p,p.dx*C.dodgeSpeed*dt,p.dz*C.dodgeSpeed*dt,C.playerRadius);
      if(p.t>=C.dodgeDuration){p.state='idle';p.t=0;}
    } else {
      const speed=C.speed*(p.state==='attack'?(p.t<.28?.24:.67):1);
      const amount=Math.min(1,ml);
      this.move(p,nx*speed*amount*dt,nz*speed*amount*dt,C.playerRadius);
      if(p.state==='attack') {
        if(p.t>=C.attackWindup&&!p.hit) {
          p.hit=true;
          if(sectorHits(p,p.attackAngle,C.attackRange,C.attackHalfAngle,r,C.robotRadius)) {
            const vulnerable=r.state==='recover',damage=vulnerable?30:18;r.hp=Math.max(0,r.hp-damage);this.hits++;
            this.emit('robot-hit',{x:r.x,z:r.z,damage,vulnerable});
            if(r.hp<=0){r.state='dead';r.t=0;this.mode='won';this.emit('win');return;}
          }else{this.misses++;this.emit('miss',{x:p.x+Math.sin(p.angle)*1.4,z:p.z+Math.cos(p.angle)*1.4});}
        }
        if(p.t>=C.attackDuration){p.state='idle';p.t=0;}
      }
    }
    r.t+=dt;
    const distance=dist(p,r),targetAngle=Math.atan2(p.x-r.x,p.z-r.z);
    if(r.state==='approach') {
      r.angle+=wrap(targetAngle-r.angle)*Math.min(1,dt*3.5);
      if(distance>2.75)this.move(r,Math.sin(targetAngle)*1.35*dt,Math.cos(targetAngle)*1.35*dt,C.robotRadius);
      if(distance<=3.45&&r.cd<=0){r.state='windup';r.t=0;r.hit=false;r.locked=false;this.emit('windup',r);}
    } else if(r.state==='windup') {
      if(r.t<.44)r.angle+=wrap(targetAngle-r.angle)*Math.min(1,dt*5);
      else if(!r.locked){r.locked=true;this.emit('lock',r);}
      if(r.t>=C.robotWindup){r.state='strike';r.t=0;this.emit('slam',{x:r.x+Math.sin(r.angle)*2.4,z:r.z+Math.cos(r.angle)*2.4});}
    } else if(r.state==='strike') {
      if(!r.hit&&sectorHits(r,r.angle,C.robotRange,C.robotHalfAngle,p,C.playerRadius)) {
        r.hit=true;
        const dodging=p.state==='dodge'&&p.t>=.025&&p.t<=.29;
        if(!dodging&&p.inv<=0) {
          p.hp=Math.max(0,p.hp-34);p.inv=.9;this.emit('player-hit',p);
          if(p.hp<=0){p.state='dead';p.t=0;this.mode='lost';this.emit('lose');return;}
        } else if(dodging)this.emit('evade',p);
      }
      if(r.t>=C.robotActive){r.state='recover';r.t=0;this.emit('recover',r);}
    }else if(r.state==='recover'&&r.t>=C.robotRecovery){r.state='approach';r.t=0;r.cd=.8;}
  }
}
