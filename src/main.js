import * as THREE from 'three';
import { Combat, C, dist } from './combat.js';
import { createMobileControls, assistedAim } from './mobile-controls.js';
import { chooseQuality, renderRatio } from './quality.js';
import '@fontsource-variable/manrope';
import '@fontsource/russo-one/cyrillic-400.css';
import '@fontsource/russo-one/latin-400.css';
import './style.css';

const $=id=>document.getElementById(id);
const ui={playerHp:$('player-hp'),robotHp:$('robot-hp'),playerFill:$('player-fill'),robotFill:$('robot-fill'),robotState:$('robot-state'),dodgeText:$('dodge-text'),dodgeDot:$('dodge-dot'),hintTitle:$('hint-title'),hintText:$('hint-text'),label:$('world-label')};
const coarseInput=matchMedia('(pointer: coarse)');
let touchMode=coarseInput.matches;
const quality=chooseQuality({touch:touchMode,memory:navigator.deviceMemory||8,cores:navigator.hardwareConcurrency||8});
let resolutionScale=1,qualityWindow=0,qualityFrames=0,qualityCooldown=6;
document.documentElement.classList.toggle('touch-mode',touchMode);
let renderer;
try {
  renderer=new THREE.WebGLRenderer({antialias:!touchMode,powerPreference:'high-performance'});
} catch(error) {
  $('fatal').classList.remove('hidden');$('fatal').textContent='Для этой сцены нужен WebGL. Откройте её в актуальном Chrome, Firefox или Edge с включённым аппаратным ускорением.';throw error;
}
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
// Fox: angular ears, cream muzzle and tail make the animal readable at gameplay scale.
const fox=group();const foxBody=group(fox);
box(M.coat,foxBody,0,.94,0,.61,.68,.44);box(M.coatDark,foxBody,0,.67,0,.69,.16,.46);box(M.cream,foxBody,0,1.05,.242,.085,.44,.025);
const head=group(foxBody,0,1.5,.035);mesh(geo.sphere,M.fox,head,0,0,0,.35,.32,.29);const muzzle=mesh(geo.cone,M.fur,head,0,-.06,.33,.22,.37,.16);muzzle.rotation.x=Math.PI/2;
mesh(geo.sphere,M.black,head,0,-.06,.49,.075,.055,.055);
for(const x of [-.22,.22]){const ear=mesh(geo.cone,M.fox,head,x,.34,-.04,.16,.41,.12);ear.rotation.z=x<0?.18:-.18;mesh(geo.cone,M.dark,head,x,.35,.025,.08,.24,.04);mesh(geo.sphere,M.black,head,x*.7,.035,.265,.037,.046,.025);}
const scarf=box(M.red,foxBody,0,1.25,.04,.53,.14,.51);const scarfTail=box(M.red,foxBody,-.15,1.01,-.28,.16,.49,.055);scarfTail.rotation.z=-.18;
const tail=group(foxBody,0,.63,-.22);const tailFur=mesh(geo.sphere,M.fox,tail,0,-.08,-.39,.22,.24,.55);tailFur.rotation.x=-.35;mesh(geo.sphere,M.fur,tail,0,-.19,-.78,.16,.17,.22);
const legs=[];for(const x of [-.18,.18]){const leg=group(fox,x,.6,0);box(M.boot,leg,0,-.25,0,.21,.5,.23);box(M.dark,leg,0,-.46,.075,.23,.15,.36);legs.push(leg);}
const leftArm=group(foxBody,-.4,1.15,0);box(M.coatDark,leftArm,0,-.19,0,.18,.43,.22);mesh(geo.sphere,M.fur,leftArm,0,-.42,.02,.1,.11,.1);
const swordArm=group(foxBody,.4,1.13,0);box(M.coat,swordArm,0,-.18,0,.19,.4,.23);mesh(geo.sphere,M.fur,swordArm,0,-.39,.04,.105,.1,.1);
const sword=group(swordArm,0,-.4,.08);box(M.black,sword,0,0,.1,.11,.11,.32);box(M.paint,sword,0,0,.3,.32,.08,.09);box(M.cream,sword,0,0,.83,.12,.065,1.03);const swordTip=mesh(geo.cone,M.cream,sword,0,0,1.42,.084,.2,.04);swordTip.rotation.x=Math.PI/2;
swordArm.rotation.x=-.5;
const robotPaint=M.paint.clone();
// Industrial robot: broad torso, pistons, single optic, oversized press hammer.
const robot=group();const robotBody=group(robot,0,.05,0);
const robotLegs=[];for(const x of [-.53,.53]){const leg=group(robot,x,1.05,0);cyl(M.metal,leg,0,-.2,0,.19,.7);box(robotPaint,leg,0,-.38,.1,.43,.52,.47);box(M.dark,leg,0,-.87,.22,.62,.25,.83);cyl(M.rust,leg,0,.04,0,.28,.24).rotation.z=Math.PI/2;robotLegs.push(leg);}
box(M.metal,robotBody,0,1.25,0,1.35,.42,.76);box(robotPaint,robotBody,0,1.94,0,1.5,1.13,.92);box(M.rust,robotBody,0,1.38,.02,1.55,.19,.98);
box(M.dark,robotBody,0,1.9,.48,1.1,.55,.09);for(let x=-.4;x<=.4;x+=.16)box(M.metal,robotBody,x,1.87,.55,.07,.35,.08);
const robotHead=group(robotBody,0,2.67,.05);box(M.metal,robotHead,0,0,0,.91,.45,.68);box(M.dark,robotHead,0,.015,.37,.73,.22,.12);box(M.eye,robotHead,0,.015,.445,.41,.075,.04);box(robotPaint,robotHead,0,.28,-.05,1.07,.14,.84);
for(const x of [-.85,.85]){const shoulder=cyl(M.rust,robotBody,x,2.3,0,.32,.27);shoulder.rotation.z=Math.PI/2;}
const robotLeft=group(robotBody,-.96,2.28,0);box(M.metal,robotLeft,0,-.4,0,.28,.72,.33);box(robotPaint,robotLeft,0,-.84,.11,.42,.47,.43);for(const x of [-.13,.13])box(M.dark,robotLeft,x,-1.12,.2,.1,.26,.27);
const hammerArm=group(robotBody,1,2.3,0);box(M.metal,hammerArm,0,-.37,0,.32,.7,.4);cyl(M.rust,hammerArm,0,-.71,0,.23,.3).rotation.z=Math.PI/2;box(M.metal,hammerArm,0,-.83,.42,.3,.29,.96);cyl(M.dark,hammerArm,0,-.83,1.05,.13,.3);const hammer=box(robotPaint,hammerArm,0,-.82,1.18,.9,.7,.7);box(M.rust,hammerArm,0,-1.19,1.18,1.05,.11,.82);for(let x=-.32;x<.4;x+=.2){const stripe=box(M.dark,hammerArm,x,-.82,1.54,.1,.56,.012);stripe.rotation.z=-.4;}
for(const x of [-.37,.37]){const piston=cyl(M.cream,robotBody,x,2.2,-.54,.065,.8);piston.rotation.x=.23;}
const serial=sign('ПР-7','1986',.55,.32,'#d0bd82','#9f8047');serial.position.set(-.36,2.24,.47);robotBody.add(serial);
const vent=new THREE.PointLight('#bfe8ae',.6,3);vent.position.set(0,2.8,.5);robot.add(vent);
// Ground-space cues use the same sector shape and distances as collision checks.
function sectorGeometry(inner,outer,half,segments=40){const verts=[];for(let i=0;i<segments;i++){const a=-half+i/segments*half*2,b=-half+(i+1)/segments*half*2;verts.push(Math.sin(a)*inner,0,Math.cos(a)*inner,Math.sin(a)*outer,0,Math.cos(a)*outer,Math.sin(b)*outer,0,Math.cos(b)*outer,Math.sin(a)*inner,0,Math.cos(a)*inner,Math.sin(b)*outer,0,Math.cos(b)*outer,Math.sin(b)*inner,0,Math.cos(b)*inner);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.computeVertexNormals();return g;}
function cue(g,color,opacity){const o=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));o.position.y=.115;scene.add(o);return o;}
const aimArc=cue(sectorGeometry(C.attackRange-.028,C.attackRange,C.attackHalfAngle),'#bfdab0',.45);
const aimTick=cue(sectorGeometry(.59,1.02,.018),'#d4ecc4',.65);
const swordArc=cue(sectorGeometry(.65,C.attackRange,C.attackHalfAngle),'#e7f6c5',0);
const warning=cue(sectorGeometry(.94,C.robotRange,C.robotHalfAngle),'#db7947',.17);
const warningEdge=cue(sectorGeometry(C.robotRange-.05,C.robotRange,C.robotHalfAngle),'#ffb36c',.8);
const robotRing=cue(new THREE.RingGeometry(1.02,1.055,60),'#d0a35c',.5);robotRing.rotation.x=-Math.PI/2;
const cursor=new THREE.Group();const cursorMat=new THREE.MeshBasicMaterial({color:'#d3e0bb',transparent:true,opacity:.8});for(let i=0;i<4;i++){const t=new THREE.Mesh(new THREE.BoxGeometry(.1,.012,.025),cursorMat);t.position.set(Math.cos(i*Math.PI/2)*.19,0,Math.sin(i*Math.PI/2)*.19);t.rotation.y=i*Math.PI/2;cursor.add(t);}scene.add(cursor);
const dustCount=quality.dustCount,dustPositions=new Float32Array(dustCount*3);for(let i=0;i<dustCount;i++){dustPositions[i*3]=(rand()-.5)*23;dustPositions[i*3+1]=.5+rand()*6;dustPositions[i*3+2]=(rand()-.5)*18;}const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#d9d7a4',size:.035,transparent:true,opacity:.42,depthWrite:false}));scene.add(dust);

let audio,muted=false;function sound(type){if(muted)return;try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume();const now=audio.currentTime;const cfg={swing:[180,60,.12,.04,'triangle'],windup:[80,145,.65,.035,'sawtooth'],lock:[320,250,.08,.03,'square'],slam:[65,25,.32,.13,'triangle'],hit:[750,120,.13,.07,'square'],'player-hit':[130,40,.25,.11,'sawtooth'],dodge:[250,550,.09,.025,'sine'],win:[360,720,.6,.05,'sine']}[type];if(!cfg)return;const o=audio.createOscillator(),g=audio.createGain();o.type=cfg[4];o.frequency.setValueAtTime(cfg[0],now);o.frequency.exponentialRampToValueAtTime(cfg[1],now+cfg[2]);g.gain.setValueAtTime(cfg[3],now);g.gain.exponentialRampToValueAtTime(.001,now+cfg[2]);o.connect(g);g.connect(audio.destination);o.start();o.stop(now+cfg[2]);}catch{}}
const particles=[],floaters=[];let shake=0,hitstop=0,robotFlash=0,playerFlash=0,outcomeTime=0;
function burst(x,z,color,count=14,strength=1){count=Math.min(Math.ceil(count*(quality.low?.45:quality.touch?.7:1)),quality.particleLimit-particles.length);for(let i=0;i<count;i++){const o=mesh(geo.box,new THREE.MeshBasicMaterial({color,transparent:true}),scene,x,.7,z,.035+rand()*.06,.035,.035);particles.push({o,vx:(rand()-.5)*5*strength,vy:1+rand()*4*strength,vz:(rand()-.5)*5*strength,t:0,life:.25+rand()*.45});}}
function floating(text,x,z,color,miss=false){const el=document.createElement('div');el.className='floating'+(miss?' miss':'');el.textContent=text;el.style.color=color;$('feedback').appendChild(el);floaters.push({el,x,z,t:0,life:miss?.7:.9});}
function clearEffects(){for(const p of particles){scene.remove(p.o);p.o.material.dispose();}particles.length=0;for(const f of floaters)f.el.remove();floaters.length=0;robotFlash=playerFlash=shake=hitstop=outcomeTime=0;}
const game=new Combat((type,data)=>{
  if(type==='reset'){clearEffects();return;}
  if(type==='robot-hit'){burst(data.x,data.z,data.vulnerable?'#dceba1':'#f7c475',18);floating('−'+data.damage,data.x,data.z,data.vulnerable?'#d8f2a6':'#f5d5a1');robotFlash=.16;shake=.06;hitstop=.055;sound('hit');}
  else if(type==='player-hit'){burst(data.x,data.z,'#d18f64',14);floating('−34',data.x,data.z,'#f1a980');playerFlash=.2;shake=.14;hitstop=.085;sound(type);}
  else if(type==='miss')floating('ПРОМАХ',data.x,data.z,'#d0d1b5',true);
  else if(type==='slam'){burst(data.x,data.z,'#d5ba84',24,1.4);shake=.12;sound(type);}
  else if(type==='evade')floating('УКЛОНЕНИЕ',data.x,data.z,'#bce0c0',true);
  else if(type==='win'||type==='lose'){outcomeTime=0;if(type==='win'){burst(game.robot.x,game.robot.z,'#e6b76d',32,1.5);sound('win');}updatePanels();}
  else sound(type);
});
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
function start(){mobile.reset();keys.clear();attackPressed=dodgePressed=false;game.start();sound('dodge');updatePanels();}
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
function frame(now){requestAnimationFrame(frame);const rawDt=(now-last)/1000,dt=Math.min(rawDt,.1);last=now;visualTime+=dt;
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
 if(hitstop>0){hitstop=Math.max(0,hitstop-dt);accumulator=0;}else{accumulator+=dt;let first=true;while(accumulator>=step){game.update(step,{...input,attack:first&&attack,dodge:first&&dodgePressed});if(first){attackPressed=false;dodgePressed=false;}first=false;accumulator-=step;}}
 const active=game.mode==='playing',moving=active&&(sx||sy),stride=visualTime*13;
 fox.position.set(p.x,0,p.z);fox.rotation.y=p.angle;foxBody.position.y=moving?.035*Math.sin(stride*2):Math.sin(visualTime*2)*.012;
 foxBody.rotation.x=p.state==='dodge'?-Math.sin(p.t/C.dodgeDuration*Math.PI)*.65:0;foxBody.rotation.z=0;
 legs.forEach((leg,i)=>leg.rotation.x=moving?Math.sin(stride+i*Math.PI)*.55:0);leftArm.rotation.x=moving?Math.sin(stride)*.2:0;tail.rotation.y=Math.sin(visualTime*3)*.14;scarfTail.rotation.x=Math.sin(visualTime*4)*.12;
 if(p.state==='attack'){const t=p.t;const swing=t<.16?-.7*(t/.16):t<.28?-.7+2.6*(t-.16)/.12:1.9*(1-(t-.28)/.34);swordArm.rotation.y=swing;swordArm.rotation.x=-.9;foxBody.rotation.y=swing*.1;}else{swordArm.rotation.y=.25;swordArm.rotation.x=-.45;foxBody.rotation.y=0;}
 if(p.state==='dead'){fox.rotation.z=THREE.MathUtils.lerp(fox.rotation.z,-1.4,dt*4);fox.position.y=-.05;}else fox.rotation.z=0;
 fox.visible=!(p.inv>0&&Math.floor(p.inv*16)%2===0&&playerFlash<=0);
 robot.position.set(r.x,0,r.z);robot.rotation.y=r.angle;
 const stepping=active&&r.state==='approach'&&dist(p,r)>2.75;robotLegs.forEach((leg,i)=>leg.rotation.x=stepping?Math.sin(visualTime*6+i*Math.PI)*.22:0);
 robotBody.position.y=.05+(stepping?Math.abs(Math.sin(visualTime*6))*.045:Math.sin(visualTime*1.5)*.012);
 let hammerLift=0,lean=0;
 if(r.state==='windup'){const progress=Math.min(1,r.t/C.robotWindup);hammerLift=-2.2*THREE.MathUtils.smoothstep(progress,0,.7);lean=-progress*.08;robotBody.rotation.z=Math.sin(visualTime*35)*.012*progress;}
 else if(r.state==='strike'){hammerLift=-2.2+3.15*Math.min(1,r.t/.1);lean=.1;robotBody.rotation.z=0;}
 else if(r.state==='recover'){hammerLift=.95*(1-THREE.MathUtils.smoothstep(r.t,1.2,1.8));lean=.1*(1-r.t/C.robotRecovery);robotBody.rotation.z=0;}
 else {robotBody.rotation.z=0;}
 hammerArm.rotation.x=hammerLift;robotBody.rotation.x=lean;robotLeft.rotation.x=r.state==='windup'?-.25:0;
 if(r.state==='dead'){outcomeTime+=dt;robotBody.rotation.z=Math.min(1.25,outcomeTime*1.4);robotBody.position.y=-Math.min(.7,outcomeTime*.7);hammerArm.rotation.x=1;M.eye.emissiveIntensity=.05;}else{M.eye.emissiveIntensity=r.state==='windup'?2+Math.sin(visualTime*20):1.5;}
 if(game.mode==='lost')outcomeTime+=dt;
 robotFlash=Math.max(0,robotFlash-dt);playerFlash=Math.max(0,playerFlash-dt);robotPaint.emissive.set(robotFlash>0?'#c6ad72':'#000000');robotPaint.emissiveIntensity=robotFlash>0?.7:0;M.coat.emissive.set(playerFlash>0?'#d7b295':'#000000');M.coat.emissiveIntensity=playerFlash>0?.8:0;
 pShadow.position.x=p.x;pShadow.position.z=p.z;rShadow.position.x=r.x;rShadow.position.z=r.z;
 for(const o of [aimArc,aimTick,swordArc]){o.position.x=p.x;o.position.z=p.z;o.rotation.y=p.angle;o.visible=active;}
 aimArc.material.opacity=p.state==='attack'?.2:.36;const swingActive=p.state==='attack'&&p.t>=.13&&p.t<.34;swordArc.material.opacity=swingActive?Math.max(0,.3*(1-(p.t-.13)/.21)):0;
 const telegraph=active&&(r.state==='windup'||r.state==='strike');
 for(const o of [warning,warningEdge]){o.visible=telegraph;o.position.x=r.x;o.position.z=r.z;o.rotation.y=r.angle;}
 warning.material.opacity=r.state==='strike'?.5:.09+.14*Math.min(1,r.t/C.robotWindup);warningEdge.material.opacity=r.state==='strike'?.95:r.locked?.65+Math.sin(visualTime*20)*.2:.42;warning.material.color.set(r.locked?'#e99551':'#ce9959');
 robotRing.position.x=r.x;robotRing.position.z=r.z;robotRing.visible=r.hp>0;robotRing.material.color.set(r.state==='recover'?'#b6e299':'#c79c5b');robotRing.material.opacity=r.state==='recover'?.8:.32;
 cursor.position.set(aim.x,.12,aim.z);cursor.visible=active&&!touchMode&&Math.abs(aim.x)<9&&Math.abs(aim.z)<7;
 for(let i=particles.length-1;i>=0;i--){const q=particles[i];q.t+=dt;q.o.position.x+=q.vx*dt;q.o.position.z+=q.vz*dt;q.o.position.y+=q.vy*dt;q.vy-=11*dt;q.o.rotation.x+=dt*6;q.o.rotation.z+=dt*4;q.o.material.opacity=1-q.t/q.life;if(q.t>=q.life){scene.remove(q.o);q.o.material.dispose();particles.splice(i,1);}}
 for(let i=floaters.length-1;i>=0;i--){const f=floaters[i];f.t+=dt;const s=project(f.x,2+f.t*.7,f.z);f.el.style.left=s.x+'px';f.el.style.top=s.y+'px';f.el.style.opacity=Math.min(1,(f.life-f.t)*3);if(f.t>=f.life){f.el.remove();floaters.splice(i,1);}}
 for(let i=0;i<dustCount;i++){dustPositions[i*3]+=.07*dt;dustPositions[i*3+1]+=.025*dt;if(dustPositions[i*3]>12)dustPositions[i*3]=-12;}dustGeo.attributes.position.needsUpdate=true;
 shake=Math.max(0,shake-dt*.6);camera.position.copy(cameraBase);if(shake>0&&active){camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake;}camera.lookAt(cameraTarget);
 hudTimer+=dt;if(hudTimer>.07){syncHUD();hudTimer=0;}
 renderer.render(scene,camera);
}
requestAnimationFrame(frame);
// Read-only observability for QA; gameplay remains driven by regular mouse/keyboard events.
window.__combatSnapshot=()=>({mode:game.mode,player:{...game.player},robot:{...game.robot},hits:game.hits,misses:game.misses,elapsed:game.elapsed,mobile:{touchMode,movement:{...mobile.movement},attackHeld:mobile.attackHeld},quality:{pixelRatio:renderer.getPixelRatio(),shadows:renderer.shadowMap.enabled},drawCalls:renderer.info.render.calls});
