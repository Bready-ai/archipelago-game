import * as THREE from 'three';
import { Combat, C, dist, wrap, sectorHits } from './combat.js';
import { createMobileControls, assistedAim } from './mobile-controls.js';
import { chooseQuality, renderRatio } from './quality.js';
import { createGameRenderer } from './renderer.js';
import { createActors,GROUND_Y } from './actors.js';
import { ActorAnimator } from './animation.js';
import { createHammerDebug } from './hammer-debug.js';
import { ContactEffects } from './contact-effects.js';
import '@fontsource-variable/manrope';
import '@fontsource/russo-one/cyrillic-400.css';
import '@fontsource/russo-one/latin-400.css';
import './style.css';

const $=id=>document.getElementById(id);
const ui={playerHp:$('player-hp'),robotHp:$('robot-hp'),playerFill:$('player-fill'),robotFill:$('robot-fill'),robotState:$('robot-state'),dodgeText:$('dodge-text'),dodgeDot:$('dodge-dot'),hintTitle:$('hint-title'),hintText:$('hint-text'),label:$('world-label')};
const coarseInput=matchMedia('(pointer: coarse)');
let touchMode=coarseInput.matches||navigator.maxTouchPoints>0;
const quality=chooseQuality({touch:touchMode,memory:navigator.deviceMemory||8,cores:navigator.hardwareConcurrency||8});
let resolutionScale=1,qualityWindow=0,qualityFrames=0,qualityCooldown=6;
document.documentElement.classList.toggle('touch-mode',touchMode);
const boot=window.__pustoshBoot;
boot.report.threeRevision=THREE.REVISION;
const renderer=createGameRenderer({WebGLRenderer:THREE.WebGLRenderer,createCanvas:()=>document.createElement('canvas'),touch:touchMode,diagnostics:boot});
boot.setStage('scene-setup');
renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{
  const details={program:gl.getProgramInfoLog(program),vertex:gl.getShaderInfoLog(vertex),fragment:gl.getShaderInfoLog(fragment)};
  boot.fail(new Error('Ошибка компиляции шейдеров: '+JSON.stringify(details)),{phase:'shader-compilation'});
};
renderer.domElement.addEventListener('webglcontextlost',event=>{
  event.preventDefault();boot.fail(new Error(event.statusMessage||'Событие webglcontextlost: драйвер потерял созданный WebGL 2-контекст.'),{phase:'context-lost'});
});
$('build-id').textContent='Сборка '+boot.report.build;
renderer.setPixelRatio(renderRatio(quality,innerWidth,innerHeight,devicePixelRatio));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.32;
$('scene').appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#23352e');scene.fog=new THREE.FogExp2('#293b31',.018);
const camera=new THREE.OrthographicCamera(-15,15,10,-10,.1,110);
const cameraBase=new THREE.Vector3(12,18,17),cameraTarget=new THREE.Vector3(0,.25,0);
camera.position.copy(cameraBase);camera.lookAt(cameraTarget);
const hemi=new THREE.HemisphereLight('#c4dfcc','#263d32',2.6);scene.add(hemi);
const sun=new THREE.DirectionalLight('#ffdc9a',4.2);sun.position.set(-8,14,-7);sun.castShadow=true;sun.shadow.mapSize.set(quality.shadowSize,quality.shadowSize);sun.shadow.camera.left=-15;sun.shadow.camera.right=15;sun.shadow.camera.top=15;sun.shadow.camera.bottom=-15;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;sun.shadow.radius=3;scene.add(sun);sun.target.position.set(0,0,0);scene.add(sun.target);
const fill=new THREE.DirectionalLight('#9dc9c2',1.1);fill.position.set(8,7,9);scene.add(fill);
const mat=(color,roughness=.86,metalness=.05)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const M={concrete:mat('#6a6e59'),edge:mat('#535c4e'),wall:mat('#7d8069'),dark:mat('#2b3e35'),metal:mat('#354c42',.62,.45),rust:mat('#8b5036'),paint:mat('#b7954f'),yellow:mat('#c2a45a'),black:mat('#303a30'),cream:mat('#d4c7a0'),grass:mat('#727c46'),fox:mat('#b87a42'),fur:mat('#ddd2aa'),coat:mat('#3f7e75'),coatDark:mat('#285f59'),red:mat('#ac5942'),boot:mat('#36443a'),eye:new THREE.MeshStandardMaterial({color:'#c9f9c4',emissive:'#9cefaf',emissiveIntensity:2}),glow:new THREE.MeshStandardMaterial({color:'#f1c779',emissive:'#f0ab4e',emissiveIntensity:.9})};
const geo={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,10,8),cyl:new THREE.CylinderGeometry(1,1,1,12),cone:new THREE.ConeGeometry(1,1,4)};
function mesh(g,m,parent=scene,x=0,y=0,z=0,sx=1,sy=sx,sz=sx){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
const box=(m,parent,x,y,z,sx,sy,sz)=>mesh(geo.box,m,parent,x,y,z,sx,sy,sz);
const cyl=(m,parent,x,y,z,r,h)=>mesh(geo.cyl,m,parent,x,y,z,r,h,r);
function group(parent=scene,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
let seed=713;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
function sign(text,sub,w=3,h=1,color='#c5bb8c',bg='#35483a'){
  const c=document.createElement('canvas');c.width=768;c.height=256;const cx=c.getContext('2d');cx.fillStyle=bg;cx.fillRect(0,0,768,256);cx.strokeStyle=color;cx.lineWidth=5;cx.strokeRect(15,15,738,226);cx.fillStyle=color;cx.textAlign='center';cx.font='bold 87px Arial';cx.fillText(text,384,125);cx.font='26px monospace';cx.fillText(sub,384,191);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:1}));o.castShadow=true;return o;
}
// A self-contained diorama: chipped slabs, old service infrastructure, empty centre.
const yard=group();
box(M.edge,yard,0,-.46,0,19,.85,15);
box(M.dark,yard,0,-.94,0,18.5,.13,14.5);
const floorPalette=Array.from({length:6},(_,i)=>mat(new THREE.Color('#7e816b').multiplyScalar(.9+i*.034)));
for(let x=-4;x<=4;x++)for(let z=-3;z<=3;z++){
  const shade=floorPalette[Math.floor(rand()*floorPalette.length)];
  box(shade,yard,x*2.04,-.01-rand()*.018,z*2.04,2,.16,2);
}
// Surface scratches and asphalt repairs are baked to one transparent ground layer.
const gc=document.createElement('canvas');gc.width=gc.height=1024;const ctx=gc.getContext('2d');
for(let i=0;i<1900;i++){ctx.fillStyle=`rgba(35,49,37,${rand()*.15})`;ctx.fillRect(rand()*1024,rand()*1024,1+rand()*5,1+rand()*2);}
for(let i=0;i<64;i++){let x=rand()*1024,y=rand()*1024;ctx.strokeStyle='rgba(36,48,36,.35)';ctx.lineWidth=1+rand();ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<4;j++){x+=(rand()-.5)*60;y+=rand()*35;ctx.lineTo(x,y);}ctx.stroke();}
const groundMap=new THREE.CanvasTexture(gc);const groundDetail=new THREE.Mesh(new THREE.PlaneGeometry(18.7,14.7),new THREE.MeshBasicMaterial({map:groundMap,transparent:true,depthWrite:false}));groundDetail.rotation.x=-Math.PI/2;groundDetail.position.y=.081;scene.add(groundDetail);
// Faded work-bay markings frame the fight without obscuring distance.
function groundLine(x,z,w,d,color=M.yellow){const m=box(color,yard,x,.085,z,w,.008,d);m.castShadow=false;}
for(const x of [-4.6,4.6]){groundLine(x,0,.075,8.5);for(let z=-4;z<=4;z+=.42){const stripe=box(M.paint,yard,x+(x<0?-.3:.3),.086,z,.54,.009,.17);stripe.rotation.y=-.55;stripe.castShadow=false;}}
for(const z of [-4.25,4.25]){groundLine(0,z,9.2,.075);}
const stencil=sign('07','РЕМОНТНАЯ ЗОНА',2.2,.74,'#b1ad79','#747b63');stencil.rotation.x=-Math.PI/2;stencil.rotation.z=Math.PI;stencil.position.set(2.8,.089,3.6);stencil.material.transparent=true;stencil.material.opacity=.5;scene.add(stencil);
// Rear workshop wall and its broken roofline.
box(M.wall,yard,0,1.05,-6.8,19,2.1,.52);
for(let x=-8.8;x<=8.8;x+=3.15){box(M.edge,yard,x,1.3,-6.45,.28,2.6,.32);box(M.cream,yard,x,2.6,-6.45,.45,.12,.5);}
box(M.metal,yard,1.2,1.15,-6.48,4.4,2.15,.18);
for(let x=-.8;x<3.3;x+=.25)box(M.dark,yard,x,1.16,-6.36,.045,2.05,.04);
const workshopSign=sign('ЦЕХ № 4','РЕМОНТ • ОБСЛУЖИВАНИЕ',3.35,1.02);workshopSign.position.set(1.2,3.03,-6.78);scene.add(workshopSign);
box(M.edge,yard,-4.3,2.25,-6.85,4.3,.25,.8);
box(M.wall,yard,-7.2,2.5,-6.8,2.5,.9,.55);
box(M.wall,yard,6,2.37,-6.8,2.1,.55,.55);
for(let i=0;i<12;i++){const o=box(M.edge,yard,-9+rand()*18,2.15+rand()*.2,-6.8,.12+rand()*.4,.3+rand()*.5,.5);o.rotation.z=(rand()-.5)*.4;}
// Door lamp, Soviet-era caution plate, dead window frames.
const caution=sign('СТОЙ!','ОПАСНАЯ ЗОНА',1.05,.8,'#d3b769','#854d35');caution.position.set(4.65,1.5,-6.5);scene.add(caution);
for(let x=-7;x<-2;x+=1.9){box(M.dark,yard,x,1.6,-6.49,1.35,.8,.1);for(let a=-.5;a<=.5;a+=.5)box(M.metal,yard,x+a,1.6,-6.38,.035,.85,.04);box(M.metal,yard,x,1.6,-6.36,1.4,.035,.04);}
const lamp=box(M.glow,yard,1.2,2.45,-6.05,.7,.12,.22);const lampLight=new THREE.PointLight('#edc56e',3,4);lampLight.position.set(1.2,2.35,-5.8);scene.add(lampLight);
// Left: rusted pressure vessel on sleepers, bent pipes and a steel ladder.
const tank=group(yard,-7.5,.2,-3.4);const tankBody=cyl(M.metal,tank,0,1.4,0,1.05,2.4);tankBody.rotation.x=Math.PI/2;
for(const z of [-1,1]){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.06,.06,6,20),M.rust);ring.position.set(0,1.4,z);tank.add(ring);box(M.rust,tank,0,.25,z,1.6,.4,.3);}
const cap=mesh(geo.sphere,M.metal,tank,0,1.4,1.2,1.04,1.04,.2);cyl(M.rust,tank,.4,2.75,-.5,.15,.7);box(M.paint,tank,-.7,1.8,.7,.09,.14,.8);
for(let i=0;i<4;i++)box(M.rust,tank,-1.03,.5+i*.4,0,.07,.06,1.5);
for(let i=0;i<3;i++){const pipe=cyl(M.rust,yard,-8.45+i*.27,.28,1.4,.095,3.1);pipe.rotation.x=Math.PI/2;}
// Right: cable reel, crates and a battered electrical cabinet.
const reel=group(yard,7.3,.1,2.4);const reelCore=cyl(M.dark,reel,0,.65,0,.47,1.2);reelCore.rotation.z=Math.PI/2;
for(let x of [-.6,.6]){const disk=cyl(M.rust,reel,x,.65,0,.78,.12);disk.rotation.z=Math.PI/2;}
for(let i=0;i<10;i++){const cable=new THREE.Mesh(new THREE.TorusGeometry(.48,.04,4,14),M.black);cable.rotation.y=Math.PI/2;cable.position.set(-.45+i*.1,.65,0);reel.add(cable);}
const cabinet=group(yard,6.9,.1,-4.5);box(M.metal,cabinet,0,.8,0,1.3,1.6,.7);box(M.edge,cabinet,0,1.7,0,1.45,.12,.85);box(M.dark,cabinet,0,.9,.38,1.05,1.2,.06);for(let i=0;i<5;i++)box(M.metal,cabinet,0,1.16-i*.12,.42,.72,.035,.05);box(M.paint,cabinet,.33,.7,.45,.1,.17,.05);
function crate(x,z,s=1){const g=group(yard,x,.1,z);box(M.dark,g,0,s*.5,0,s,s,s);for(const a of [-1,1]){box(M.edge,g,a*s*.46,s*.5,0,s*.08,s,s);box(M.edge,g,0,s*.5,a*s*.46,s,s*.1,s*.08);}return g;}
crate(-6.8,4.5,1.1);const c2=crate(-7.8,4.6,.7);c2.rotation.y=.2;
for(const [x,z] of [[7,-1.4],[8,-2.1],[-5.9,-5.5]]){cyl(M.rust,yard,x,.57,z,.37,.95);for(const y of [.25,.85])cyl(M.dark,yard,x,y,z,.39,.06);}
// Perimeter rubble and dry plants; the playable surface remains open.
for(let i=0;i<65;i++){const side=rand()>.5?1:-1,x=(6+rand()*3.2)*side,z=(rand()-.5)*12; if(Math.abs(z)<4&&Math.abs(x)<7)continue;const r=box(i%4===0?M.rust:M.edge,yard,x,.12+rand()*.1,z,.1+rand()*.3,.1+rand()*.25,.15+rand()*.4);r.rotation.set(rand()*.3,rand()*3,rand()*.2);}
for(let i=0;i<40;i++){const x=(6.3+rand()*2.7)*(rand()>.5?1:-1),z=(rand()-.5)*12;const g=group(yard,x,.12,z);for(let j=0;j<3;j++){const blade=mesh(geo.cone,M.grass,g,(rand()-.5)*.2,.16,(rand()-.5)*.2,.035,.2+rand()*.4,.025);blade.rotation.z=(rand()-.5)*.6;}}
// Low front and side boundary posts leave the silhouettes visible.
for(const x of [-9.2,9.2])for(let z=-5.5;z<7;z+=2.7){box(M.edge,yard,x,.4,z,.18,.8,.18);box(M.rust,yard,x,.7,z,.24,.12,.24);}
for(let x=-8.4;x<=8.4;x+=2.8){box(M.edge,yard,x,.18,7,.6,.3,.38);}
// The courtyard never moves. Instance repeated geometry/materials to reduce draw calls.
yard.updateMatrixWorld(true);
const staticBatches=new Map();
yard.traverse(o=>{
  if(!o.isMesh)return;
  const key=[o.geometry.uuid,o.material.uuid,o.castShadow,o.receiveShadow].join(':');
  if(!staticBatches.has(key))staticBatches.set(key,[]);
  staticBatches.get(key).push(o);
});
for(const objects of staticBatches.values()){
  const source=objects[0],batch=new THREE.InstancedMesh(source.geometry,source.material,objects.length);
  objects.forEach((o,i)=>batch.setMatrixAt(i,o.matrixWorld));
  batch.castShadow=source.castShadow;batch.receiveShadow=source.receiveShadow;
  batch.computeBoundingSphere();scene.add(batch);
}
scene.remove(yard);
function contact(radius,color,opacity){const m=new THREE.Mesh(new THREE.CircleGeometry(radius,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.105;scene.add(m);return m;}
const pShadow=contact(.56,'#142e25',.27),rShadow=contact(1.15,'#142e25',.3);
const actors=createActors({materials:M,geometries:geo,makeSign:sign});
const fox=actors.fox.root,robot=actors.robot.root,robotPaint=actors.robot.paint;scene.add(fox,robot);
const foxAnimator=new ActorAnimator(actors.fox,'fox'),robotAnimator=new ActorAnimator(actors.robot,'robot');
const hammerDebug=createHammerDebug(scene,actors.robot);
// Ground-space cues use the same sector shape and distances as collision checks.
function sectorGeometry(inner,outer,half,segments=40){const verts=[];for(let i=0;i<segments;i++){const a=-half+i/segments*half*2,b=-half+(i+1)/segments*half*2;verts.push(Math.sin(a)*inner,0,Math.cos(a)*inner,Math.sin(a)*outer,0,Math.cos(a)*outer,Math.sin(b)*outer,0,Math.cos(b)*outer,Math.sin(a)*inner,0,Math.cos(a)*inner,Math.sin(b)*outer,0,Math.cos(b)*outer,Math.sin(b)*inner,0,Math.cos(b)*inner);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.computeVertexNormals();return g;}
function cue(g,color,opacity){const o=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));o.position.y=.115;scene.add(o);return o;}
const aimArc=cue(sectorGeometry(C.attackRange-.028,C.attackRange,C.attackHalfAngle),'#bfdab0',.45);
const aimTick=cue(sectorGeometry(.59,1.02,.018),'#d4ecc4',.65);
const contactFX=new ContactEffects(scene,quality,geo,sectorGeometry);
const warning=cue(sectorGeometry(.94,C.robotRange,C.robotHalfAngle),'#db7947',.17);
const warningEdge=cue(sectorGeometry(C.robotRange-.05,C.robotRange,C.robotHalfAngle),'#ffb36c',.8);
const robotRing=cue(new THREE.RingGeometry(1.02,1.055,60),'#d0a35c',.5);robotRing.rotation.x=-Math.PI/2;
const cursor=new THREE.Group();const cursorMat=new THREE.MeshBasicMaterial({color:'#d3e0bb',transparent:true,opacity:.8});for(let i=0;i<4;i++){const t=new THREE.Mesh(new THREE.BoxGeometry(.1,.012,.025),cursorMat);t.position.set(Math.cos(i*Math.PI/2)*.19,0,Math.sin(i*Math.PI/2)*.19);t.rotation.y=i*Math.PI/2;cursor.add(t);}scene.add(cursor);
const dustCount=quality.dustCount,dustPositions=new Float32Array(dustCount*3);for(let i=0;i<dustCount;i++){dustPositions[i*3]=(rand()-.5)*23;dustPositions[i*3+1]=.5+rand()*6;dustPositions[i*3+2]=(rand()-.5)*18;}const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#d9d7a4',size:.035,transparent:true,opacity:.42,depthWrite:false}));scene.add(dust);

let audio,noiseBuffer,muted=false;
function sound(type){
  if(muted)return;
  try{
    audio??=new AudioContext();if(audio.state==='suspended')audio.resume();const now=audio.currentTime;
    function tone(frequency,end,duration,volume,wave='sine'){
      const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type=wave;
      oscillator.frequency.setValueAtTime(frequency,now);oscillator.frequency.exponentialRampToValueAtTime(end,now+duration);
      gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
      oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(now);oscillator.stop(now+duration);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    }
    function noise(duration,volume,frequency,filterType='lowpass'){
      if(!noiseBuffer){noiseBuffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*.25),audio.sampleRate);const samples=noiseBuffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;}
      const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=noiseBuffer;filter.type=filterType;filter.frequency.value=frequency;
      gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
      source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start(now);source.stop(now+duration);
      source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    }
    if(type==='hit'){[920,1370,2170].forEach((f,i)=>tone(f,f*.83,.13+i*.025,.025/(i+1)));noise(.075,.045,2400,'bandpass');return;}
    if(type==='slam'){tone(65,26,.25,.10,'triangle');tone(170,115,.17,.025);noise(.18,.09,480);return;}
    if(type==='player-hit'){tone(95,38,.21,.07,'triangle');noise(.13,.065,1100);return;}
    if(type==='swing'){noise(.11,.055,1700,'bandpass');return;}
    const cfg={windup:[80,145,.65,.024,'sawtooth'],lock:[320,250,.08,.022,'square'],dodge:[250,550,.09,.022,'sine'],win:[360,720,.6,.045,'sine']}[type];
    if(cfg)tone(...cfg);
  }catch{/* Audio must never block combat. */}
}
const floaters=[];let shake=0,hitstop=0,robotFlash=0,playerFlash=0,outcomeTime=0,contactSource='',pendingSwoosh=false;
const contactPoint=new THREE.Vector3();
function floating(text,x,z,color,miss=false){const el=document.createElement('div');el.className='floating'+(miss?' miss':'');el.textContent=text;el.style.color=color;$('feedback').appendChild(el);floaters.push({el,x,z,t:0,life:miss?.7:.9});}
function clearEffects(){contactFX.reset();for(const f of floaters)f.el.remove();floaters.length=0;robotFlash=playerFlash=shake=hitstop=outcomeTime=0;contactSource='';pendingSwoosh=false;}
const game=new Combat((type,data)=>{
  if(type==='reset'){clearEffects();return;}
  if(type==='robot-hit'){
    const p=game.player,r=game.robot,dx=r.x-p.x,dz=r.z-p.z,length=Math.hypot(dx,dz)||1;
    foxAnimator.aimStrike(wrap(Math.atan2(dx,dz)-p.attackAngle));
    const tangent=p.attackAngle+foxAnimator.contactYaw;
    robotAnimator.hit(dx/length*.8+Math.cos(tangent)*.35,dz/length*.8-Math.sin(tangent)*.35,data.vulnerable?.22:.16);
    contactPoint.set(r.x-dx/length*C.robotRadius,1.28,r.z-dz/length*C.robotRadius);
    contactFX.burst(contactPoint,data.vulnerable?'#f2e7b1':'#f7c475',data.vulnerable?16:11,1,{x:dx/length,z:dz/length});
    floating('−'+data.damage,data.x,data.z,data.vulnerable?'#d8f2a6':'#f5d5a1');robotFlash=.13;shake=data.vulnerable?.055:.035;hitstop=.055;contactSource='sword';sound('hit');
  }else if(type==='player-hit'){
    const p=game.player,r=game.robot;foxAnimator.hit(p.x-r.x,p.z-r.z,.38);
    contactPoint.set(p.x,.85,p.z);contactFX.burst(contactPoint,'#d6ba94',7,.65,{x:0,z:0},true);
    floating('−34',data.x,data.z,'#f1a980');playerFlash=.18;shake=.12;hitstop=.085;contactSource='hammer';sound(type);
  }else if(type==='swing'){
    const p=game.player,r=game.robot;foxAnimator.aimStrike(sectorHits(p,p.attackAngle,C.attackRange,C.attackHalfAngle,r,C.robotRadius)?wrap(Math.atan2(r.x-p.x,r.z-p.z)-p.attackAngle):0);
    contactFX.resetTrail();pendingSwoosh=true;
  }
  else if(type==='miss')floating('ПРОМАХ',data.x,data.z,'#d0d1b5',true);
  else if(type==='slam'){contactFX.slam(game.robot,game.robot.angle,contactPoint.set(data.x,GROUND_Y+.02,data.z));shake=.10;sound(type);}
  else if(type==='evade')floating('УКЛОНЕНИЕ',data.x,data.z,'#bce0c0',true);
  else if(type==='win'||type==='lose'){outcomeTime=0;if(type==='win')sound('win');updatePanels();}
  else sound(type);
});
function resetActors(){foxAnimator.reset(game.player);robotAnimator.reset(game.robot);}
resetActors();
const keys=new Set();let attackPressed=false,dodgePressed=false;const mouse=new THREE.Vector2(.15,0),raycaster=new THREE.Raycaster(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),aim=new THREE.Vector3(1,0,-1);
const mobile=createMobileControls({root:$('touch-controls'),joystick:$('joystick'),knob:$('joystick-knob'),attack:$('touch-attack'),dodge:$('touch-dodge'),onActivity:()=>{setTouchMode(true);audio?.resume();}});
function setTouchMode(value){touchMode=value;document.documentElement.classList.toggle('touch-mode',value);}
coarseInput.addEventListener('change',e=>setTouchMode(e.matches));
window.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')setTouchMode(true);},{capture:true});
const screenRight=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);screenRight.y=0;screenRight.normalize();const screenUp=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),screenRight).normalize();
function updatePanels(){
  mobile.setEnabled(game.mode==='playing');
  $('briefing').classList.toggle('hidden',game.mode!=='intro');$('enemy-hud').classList.toggle('hidden',game.mode==='intro');$('pause-panel').classList.toggle('hidden',game.mode!=='paused');
  const done=game.mode==='won'||game.mode==='lost';$('result').classList.toggle('hidden',!done);$('pause').textContent=game.mode==='paused'?'>':'II';$('pause').setAttribute('aria-label',game.mode==='paused'?'Продолжить':'Пауза');
  if(done){const won=game.mode==='won';$('result-title').textContent=won?'Тишина.':'Ещё не конец.';$('result-eyebrow').textContent=won?'СМОТРИТЕЛЬ ОСТАНОВЛЕН':'ЛИС ПАЛ В СХВАТКЕ';$('result-copy').textContent=won?'В старом дворе снова слышен ветер.':'Дай роботу закончить замах. Атакуй, когда он восстанавливается.';$('result-stats').replaceChildren();for(const [v,label] of [[Math.round(game.elapsed)+' с','время'],[game.hits,'попаданий']]){const s=document.createElement('span'),b=document.createElement('b');b.textContent=v;s.append(b,document.createTextNode(label));$('result-stats').appendChild(s);}}
}
function start(){if(hammerDebug)return;mobile.reset();keys.clear();attackPressed=dodgePressed=false;game.start();resetActors();sound('dodge');updatePanels();}
function pause(){game.pause();mobile.reset();keys.clear();attackPressed=dodgePressed=false;updatePanels();}
$('start').onclick=start;$('again').onclick=start;$('restart').onclick=start;$('resume').onclick=pause;$('pause').onclick=pause;
$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'♩':'♪';$('sound').style.opacity=muted?'.45':'1';$('sound').setAttribute('aria-label',muted?'Включить звук':'Выключить звук');if(!muted)sound('dodge');};
document.querySelector('.brand').onclick=e=>e.preventDefault();
window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)&&e.target===document.body)e.preventDefault();if(e.repeat)return;if(e.code==='KeyR'){start();return;}if(e.code==='Enter'&&game.mode==='intro'){start();return;}if(e.code==='Escape'){pause();return;}keys.add(e.code);if(e.code==='Space')dodgePressed=true;});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();if(game.mode==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.mode==='playing')pause();});
renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;setTouchMode(false);const b=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);});
renderer.domElement.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;setTouchMode(false);if(e.button===0&&game.mode==='playing'){attackPressed=true;audio?.resume();}renderer.domElement.focus();});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
function resize(){const w=innerWidth,h=innerHeight,aspect=w/h,span=aspect<1?26/Math.max(aspect,.4):touchMode?19:17.7;camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();renderer.setPixelRatio(renderRatio(quality,w,h,devicePixelRatio,resolutionScale));renderer.setSize(w,h);}
let landscape=innerWidth>=innerHeight;
window.addEventListener('resize',()=>{const next=innerWidth>=innerHeight;if(next!==landscape){mobile.reset();if(game.mode==='playing')pause();landscape=next;}resize();});resize();updatePanels();
function project(x,y,z){const v=new THREE.Vector3(x,y,z).project(camera);return{x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight};}
function syncHUD(){const p=game.player,r=game.robot;ui.playerHp.innerHTML=p.hp+' <small>/ 100</small>';ui.robotHp.textContent=r.hp+' / 180';ui.playerFill.style.width=p.hp+'%';ui.robotFill.style.width=(r.hp/180*100)+'%';
 const states={approach:'СБЛИЖЕНИЕ',windup:r.locked?'УДАР СКОРО • УХОДИ С ЛИНИИ':'ЗАМАХ • НАПРАВЛЕНИЕ МЕНЯЕТСЯ',strike:'ТЯЖЁЛЫЙ УДАР',recover:'ВОССТАНОВЛЕНИЕ • БРОНЯ РАСКРЫТА',dead:'СИГНАЛ ПОТЕРЯН'};ui.robotState.textContent=states[r.state];ui.robotState.style.color=r.state==='recover'?'#c9e8a6':r.state==='windup'?'#f0bb83':'#b8b999';ui.robotFill.style.background=r.state==='recover'?'#b0cf92':'#bf8c5b';
 $('touch-dodge').classList.toggle('cooldown',p.cd>0);$('touch-dodge').style.setProperty('--cooldown',Math.max(0,1-p.cd/C.dodgeCooldown));
 const ready=p.cd<=0;ui.dodgeText.textContent=ready?'Уклонение готово':'Уклонение · '+p.cd.toFixed(1)+' с';ui.dodgeDot.style.background=ready?'#a8d6a2':'#777e68';
 const distance=Math.max(0,dist(p,r)-C.robotRadius);let title='ВЫБЕРИ МОМЕНТ',text='Уклоняйся. Затем сближайся.';
 if(game.mode==='playing'){if(r.state==='recover'){title='ОКНО ДЛЯ УДАРА';text='Броня раскрыта · повышенный урон';}else if(r.state==='windup'||r.state==='strike'){title=r.locked?'НАПРАВЛЕНИЕ ЗАФИКСИРОВАНО':'ТЯЖЁЛЫЙ ЗАМАХ';text='Выйди из сектора или уклонись.';}else {title=distance<=C.attackRange?'В ПРЕДЕЛАХ УДАРА':'ДЕРЖИ ДИСТАНЦИЮ';text='До корпуса '+distance.toFixed(1)+' м · удар '+C.attackRange.toFixed(2)+' м';}}
 ui.hintTitle.textContent=title;ui.hintText.textContent=text;
 ui.label.classList.toggle('hidden',r.state!=='recover'||game.mode!=='playing');if(r.state==='recover'){const s=project(r.x,3.45,r.z);ui.label.style.left=s.x+'px';ui.label.style.top=s.y+'px';ui.label.textContent='УЯЗВИМ · '+Math.max(0,C.robotRecovery-r.t).toFixed(1)+' с';}
}
let last=performance.now(),accumulator=0,visualTime=0,hudTimer=0;const step=1/120;
window.addEventListener('pustosh:fatal',()=>{if(game.mode==='playing')pause();});
function frame(now){if(boot.failed)return;requestAnimationFrame(frame);const rawDt=(now-last)/1000,dt=Math.min(rawDt,.1);last=now;visualTime+=dt;
 if(game.mode==='playing'&&!document.hidden&&rawDt<.2){qualityWindow+=rawDt;qualityFrames++;qualityCooldown-=rawDt;
  if(qualityWindow>=3){const fps=qualityFrames/qualityWindow;
   if(fps<38&&qualityCooldown<=0&&resolutionScale>.6){resolutionScale=Math.max(.6,resolutionScale-.2);renderer.setPixelRatio(renderRatio(quality,innerWidth,innerHeight,devicePixelRatio,resolutionScale));qualityCooldown=5;}
   if(fps<27&&resolutionScale<=.6){renderer.shadowMap.enabled=false;dust.visible=false;quality.particleLimit=Math.min(quality.particleLimit,24);}
   qualityWindow=0;qualityFrames=0;
  }
 }
 raycaster.setFromCamera(mouse,camera);raycaster.ray.intersectPlane(groundPlane,aim);
 const p=game.player,r=game.robot;
 const stick=mobile.movement;
 const sx=Number(keys.has('KeyD'))-Number(keys.has('KeyA'))+stick.x,sy=Number(keys.has('KeyW'))-Number(keys.has('KeyS'))+stick.y;
 dodgePressed ||= mobile.consumeDodge();
 const attack=attackPressed||mobile.attackHeld;
 const angle=touchMode?assistedAim(p.angle,p,[r],dt,attack&&p.state==='idle'):Math.atan2(aim.x-p.x,aim.z-p.z);
 const input={x:screenRight.x*sx+screenUp.x*sy,z:screenRight.z*sx+screenUp.z*sy,angle,attack,dodge:dodgePressed};
 const beforeTime=game.time;
 const frozen=Math.min(hitstop,dt);hitstop=Math.max(0,hitstop-frozen);accumulator+=dt-frozen;
 let first=true;
 if(hammerDebug)accumulator=0;
 while(accumulator>=step){
   game.update(step,{...input,attack:first&&attack,dodge:first&&dodgePressed});
   if(first){attackPressed=false;dodgePressed=false;}first=false;accumulator-=step;
   // Render the exact contact state; do not simulate through the newly emitted hitstop.
   if(hitstop>0){accumulator=0;break;}
 }
 const simDt=game.time-beforeTime,active=game.mode==='playing';
 if(game.mode==='won'||game.mode==='lost')outcomeTime+=dt;
 const poseOptions={dt:simDt,clock:game.time,deathAge:outcomeTime,advanceRecoil:hitstop<=0};
 foxAnimator.update(p,{...poseOptions,contactHold:hitstop>0&&contactSource==='sword'});
 if(hammerDebug)hammerDebug.update(game.mode==='paused'?0:dt);else robotAnimator.update(r,poseOptions);
 fox.visible=!hammerDebug;
 if(pendingSwoosh&&p.state==='attack'&&p.t>=.11){sound('swing');pendingSwoosh=false;}
 M.eye.emissiveIntensity=r.state==='dead'?.05:r.state==='windup'?1.8:1.5;
 robotFlash=Math.max(0,robotFlash-dt);playerFlash=Math.max(0,playerFlash-dt);robotPaint.emissive.set(robotFlash>0?'#c6ad72':'#000000');robotPaint.emissiveIntensity=robotFlash>0?.7:0;M.coat.emissive.set(playerFlash>0?'#d7b295':'#000000');M.coat.emissiveIntensity=playerFlash>0?.8:0;
 pShadow.position.x=p.x;pShadow.position.z=p.z;rShadow.position.x=r.x;rShadow.position.z=r.z;
 for(const o of [aimArc,aimTick]){o.position.x=p.x;o.position.z=p.z;o.rotation.y=p.angle;o.visible=active;}
 aimArc.material.opacity=p.state==='attack'?.2:.36;
 const telegraph=active&&(r.state==='windup'||r.state==='strike');
 for(const o of [warning,warningEdge]){o.visible=telegraph;o.position.x=r.x;o.position.z=r.z;o.rotation.y=r.angle;}
 warning.material.opacity=r.state==='strike'?.5:.09+.14*Math.min(1,r.t/C.robotWindup);warningEdge.material.opacity=r.state==='strike'?.95:r.locked?.65+Math.sin(visualTime*20)*.2:.42;warning.material.color.set(r.locked?'#e99551':'#ce9959');
 robotRing.position.x=r.x;robotRing.position.z=r.z;robotRing.visible=r.hp>0;robotRing.material.color.set(r.state==='recover'?'#b6e299':'#c79c5b');robotRing.material.opacity=r.state==='recover'?.8:.32;
 cursor.position.set(aim.x,.12,aim.z);cursor.visible=active&&!touchMode&&Math.abs(aim.x)<9&&Math.abs(aim.z)<7;
 contactFX.update(game.mode==='paused'?0:dt,{fox:actors.fox,player:p,clock:game.time});
 for(let i=floaters.length-1;i>=0;i--){const f=floaters[i];f.t+=dt;const s=project(f.x,2+f.t*.7,f.z);f.el.style.left=s.x+'px';f.el.style.top=s.y+'px';f.el.style.opacity=Math.min(1,(f.life-f.t)*3);if(f.t>=f.life){f.el.remove();floaters.splice(i,1);}}
 for(let i=0;i<dustCount;i++){dustPositions[i*3]+=.07*dt;dustPositions[i*3+1]+=.025*dt;if(dustPositions[i*3]>12)dustPositions[i*3]=-12;}dustGeo.attributes.position.needsUpdate=true;
 shake*=Math.exp(-dt*16);camera.position.copy(cameraBase);if(shake>.002&&active){camera.position.x+=Math.sin(visualTime*76)*shake*.6;camera.position.y+=Math.sin(visualTime*91)*shake*.4;}camera.lookAt(cameraTarget);
 hudTimer+=dt;if(hudTimer>.07){syncHUD();hudTimer=0;}
 if(!boot.report.ready)boot.setStage('first-frame');
 if(hammerDebug){warning.visible=warningEdge.visible=robotRing.visible=rShadow.visible=pShadow.visible=cursor.visible=false;}
 renderer.render(scene,camera);
 if(!boot.report.ready)boot.markReady();
}
requestAnimationFrame(frame);
// Read-only observability for QA; gameplay remains driven by regular mouse/keyboard events.
window.__combatSnapshot=()=>({mode:game.mode,player:{...game.player},robot:{...game.robot},hits:game.hits,misses:game.misses,dodges:game.dodges,elapsed:game.elapsed,mobile:{touchMode,movement:{...mobile.movement},attackHeld:mobile.attackHeld},quality:{pixelRatio:renderer.getPixelRatio(),shadows:renderer.shadowMap.enabled},drawCalls:renderer.info.render.calls});

window.__animationSnapshot=()=>{
 const position=node=>node.getWorldPosition(new THREE.Vector3()).toArray();
 return {debug:hammerDebug?.snapshot()??null,clock:game.time,hitstop,contactSource,fox:{pelvis:position(actors.fox.pelvis),chestYaw:actors.fox.chest.rotation.y,hand:position(actors.fox.right.hand),shoulder:position(actors.fox.right.upper),tip:position(actors.fox.tip),feet:actors.fox.legs.map(l=>position(l.hand)),reaction:{...foxAnimator.reaction}},robot:{pelvis:position(actors.robot.pelvis),chestPitch:actors.robot.chest.rotation.x,chestRoll:actors.robot.chest.rotation.z,head:position(actors.robot.hammerHead),sole:position(actors.robot.sole),hand:position(actors.robot.right.hand),feet:actors.robot.legs.map(l=>position(l.hand)),reaction:{...robotAnimator.reaction}},screen:{foxGround:project(game.player.x,0,game.player.z),robotGround:project(game.robot.x,0,game.robot.z),fox:project(game.player.x,1,game.player.z),robot:project(game.robot.x,1.8,game.robot.z)},axes:{right:{x:screenRight.x,z:screenRight.z},up:{x:screenUp.x,z:screenUp.z}}};
};
