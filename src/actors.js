import * as THREE from 'three';

// Both actors face local +Z. Anatomical right is local -X (forward × up).
export const GROUND_Y=.085;
export const HAMMER_SHAFT=1.45;
export const HAMMER_SOLE=.355;
export const SWORD_TIP=1.36;
export function createActors({materials:M,geometries:G,makeSign}) {
  const group=(parent,x=0,y=0,z=0)=>{const g=new THREE.Group();g.position.set(x,y,z);parent?.add(g);return g;};
  function mesh(geometry,material,parent,x,y,z,sx,sy=sx,sz=sx){const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
  const box=(m,p,x,y,z,sx,sy,sz)=>mesh(G.box,m,p,x,y,z,sx,sy,sz);
  const ball=(m,p,x,y,z,sx,sy=sx,sz=sx)=>mesh(G.sphere,m,p,x,y,z,sx,sy,sz);
  function limb(parent,x,y,z,l1,l2,upperMat,lowerMat,width,handMat,robot=false){
    const upper=group(parent,x,y,z),lower=group(upper,0,-l1,0),hand=group(lower,0,-l2,0);
    box(upperMat,upper,0,-l1/2,0,width,l1*.88,width*1.1);
    box(lowerMat,lower,0,-l2/2,0,width*.85,l2*.88,width);
    ball(robot?M.rust:lowerMat,lower,0,0,0,width*.56);
    if(handMat)ball(handMat,hand,0,0,0,width*.53);
    return {upper,lower,hand,l1,l2};
  }
  function fox(){
    const root=group(),visual=group(root),pelvis=group(visual,0,.72,0),spine=group(pelvis,0,.15,0),chest=group(spine,0,.17,0);
    box(M.coat,chest,0,0,0,.61,.57,.44);box(M.coatDark,pelvis,0,.02,0,.68,.18,.46);box(M.cream,chest,0,.0,.242,.075,.44,.025);
    const head=group(chest,0,.49,.035);ball(M.fox,head,0,0,0,.35,.32,.29);
    const muzzle=mesh(G.cone,M.fur,head,0,-.06,.33,.22,.37,.16);muzzle.rotation.x=Math.PI/2;ball(M.black,head,0,-.06,.49,.075,.055,.055);
    for(const x of [-.22,.22]){const ear=mesh(G.cone,M.fox,head,x,.34,-.04,.16,.41,.12);ear.rotation.z=x<0?.18:-.18;mesh(G.cone,M.dark,head,x,.35,.025,.08,.24,.04);ball(M.black,head,x*.7,.035,.265,.037,.046,.025);}
    box(M.red,chest,0,.25,.04,.53,.14,.51);const scarf=box(M.red,chest,-.15,.01,-.28,.16,.49,.055);scarf.rotation.z=-.18;
    const tail=group(pelvis,0,-.08,-.22);const fur=ball(M.fox,tail,0,-.08,-.39,.22,.24,.55);fur.rotation.x=-.35;ball(M.fur,tail,0,-.19,-.78,.16,.17,.22);
    const right=limb(chest,-.39,.17,0,.32,.33,M.coat,M.coatDark,.18,M.fur);
    const left=limb(chest,.39,.17,0,.32,.33,M.coat,M.coatDark,.18,M.fur);
    const legs=[-.18,.18].map(x=>{
      const leg=limb(pelvis,x,-.03,0,.28,.29,M.boot,M.boot,.20,null);
      box(M.dark,leg.hand,0,0,.055,.23,.14,.34);return leg;
    });
    const sword=group(right.hand);box(M.black,sword,0,0,0,.10,.10,.27);box(M.paint,sword,0,0,.15,.31,.08,.07);
    box(M.cream,sword,0,0,.71,.115,.055,1.08);box(M.metal,sword,-.055,0,.71,.018,.065,1.07);
    const tipMesh=mesh(G.cone,M.cream,sword,0,0,1.30,.081,.12,.038);tipMesh.rotation.x=Math.PI/2;
    const tip=group(sword,0,0,SWORD_TIP);
    root.name='fox';right.upper.name='right-shoulder';sword.name='right-hand-sword';
    return {root,visual,pelvis,spine,chest,head,right,left,legs,sword,tip,tail,scarf};
  }
  function robot(){
    const paint=M.paint.clone(),root=group(),visual=group(root),pelvis=group(visual,0,1.17,0),spine=group(pelvis,0,.23,0),chest=group(spine,0,.48,0);
    box(M.metal,pelvis,0,.04,0,1.35,.42,.76);box(paint,chest,0,.06,0,1.5,1.13,.92);box(M.rust,pelvis,0,.21,.02,1.55,.19,.98);
    box(M.dark,chest,0,.02,.48,1.1,.55,.09);for(let x=-.4;x<=.4;x+=.16)box(M.metal,chest,x,-.01,.55,.07,.35,.08);
    const head=group(chest,0,.79,.05);box(M.metal,head,0,0,0,.91,.45,.68);box(M.dark,head,0,.015,.37,.73,.22,.12);box(M.eye,head,0,.015,.445,.41,.075,.04);box(paint,head,0,.28,-.05,1.07,.14,.84);
    const right=limb(chest,-.91,.36,0,.83,.88,M.metal,paint,.29,M.dark,true);
    const left=limb(chest,.91,.36,0,.64,.66,M.metal,paint,.29,M.dark,true);
    for(const arm of [right,left]){const cap=mesh(G.cyl,M.rust,arm.upper,0,0,0,.30,.27,.30);cap.rotation.z=Math.PI/2;}
    for(const x of [-.13,.13])box(M.dark,left.hand,x,-.07,.15,.10,.26,.27);
    const legs=[-.53,.53].map(x=>{const leg=limb(pelvis,x,-.07,0,.46,.47,M.metal,paint,.37,null,true);box(M.dark,leg.hand,0,0,.12,.62,.26,.83);return leg;});
    for(const x of [-.37,.37]){const piston=mesh(G.cyl,M.cream,chest,x,.25,-.54,.065,.8,.065);piston.rotation.x=.23;}
    if(makeSign){const serial=makeSign('ПР-7','1986',.55,.32,'#d0bd82','#9f8047');serial.position.set(-.36,.36,.47);chest.add(serial);}
    const hammer=group(right.hand);box(M.dark,hammer,0,0,.62,.13,.13,1.40);box(M.cream,hammer,.08,0,.62,.025,.025,1.15);
    const hammerHead=group(hammer,0,0,HAMMER_SHAFT);box(paint,hammerHead,0,0,0,1.16,.60,.84);box(M.rust,hammerHead,0,-.315,0,1.25,.08,.95);
    for(let x=-.42;x<.5;x+=.23){const stripe=box(M.dark,hammerHead,x,.02,.427,.105,.48,.015);stripe.rotation.z=-.4;}
    const sole=group(hammerHead,0,-HAMMER_SOLE,0);
    const vent=new THREE.PointLight('#bfe8ae',.6,3);vent.position.set(0,.9,.5);chest.add(vent);
    root.name='robot';hammer.name='press-hammer';
    return {root,visual,pelvis,spine,chest,head,right,left,legs,hammer,hammerHead,sole,paint};
  }
  const actors={fox:fox(),robot:robot()};
  // Repeated static pieces share a draw call within their animated parent bone.
  // The joint hierarchy and the independently animated scarf remain intact.
  for(const rig of Object.values(actors)){
    const parents=[];rig.root.traverse(o=>{if(o.isGroup)parents.push(o);});
    for(const parent of parents){
      const batches=new Map();
      for(const child of parent.children){
        if(!child.isMesh||child===rig.scarf)continue;
        const key=child.geometry.uuid+child.material.uuid;
        if(!batches.has(key))batches.set(key,[]);batches.get(key).push(child);
      }
      for(const pieces of batches.values())if(pieces.length>1){
        const source=pieces[0],batch=new THREE.InstancedMesh(source.geometry,source.material,pieces.length);
        pieces.forEach((piece,i)=>{piece.updateMatrix();batch.setMatrixAt(i,piece.matrix);parent.remove(piece);});
        batch.castShadow=batch.receiveShadow=true;batch.computeBoundingSphere();batch.computeBoundingBox();parent.add(batch);
      }
    }
  }
  return actors;
}
