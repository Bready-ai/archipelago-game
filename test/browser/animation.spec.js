import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

test.setTimeout(60000);
test.use({viewport:{width:960,height:600},isMobile:true,hasTouch:true});
async function snapshot(page){return page.evaluate(()=>({combat:window.__combatSnapshot(),pose:window.__animationSnapshot()}));}
async function boot(page){
  // Exercise the supported low quality profile on the software GPU; camera and geometry are unchanged.
  await page.addInitScript(()=>Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4}));
  await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.goto('./');
  await expect.poll(()=>page.evaluate(()=>typeof window.__animationSnapshot)).toBe('function');
  await page.clock.runFor(32);await page.keyboard.press('Enter');await page.clock.runFor(16);
}
async function until(page,predicate,max=6000){
  for(let t=0;t<max;t+=32){const s=await snapshot(page);if(predicate(s))return s;await page.clock.runFor(32);}
  throw new Error('Animation condition not reached: '+JSON.stringify(await snapshot(page)));
}
async function capture(page,name){
  if(!process.env.ANIMATION_REVIEW_DIR)return;
  await mkdir(process.env.ANIMATION_REVIEW_DIR,{recursive:true});
  // Capture the current compositor frame directly: screenshot stabilization requires RAFs,
  // which are intentionally paused at the exact combat pose in this test.
  const session=await page.context().newCDPSession(page);
  const result=await session.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(path.join(process.env.ANIMATION_REVIEW_DIR,name+'.png'),Buffer.from(result.data,'base64'));await session.detach();
}
function local(point,entity){const dx=point[0]-entity.x,dz=point[2]-entity.z,c=Math.cos(entity.angle),s=Math.sin(entity.angle);return{x:c*dx-s*dz,z:s*dx+c*dz};}

test('sequential sword attacks sweep across the body in four game-camera directions',async({page})=>{
  await boot(page);
  let index=0;
  for(const [dx,dy] of [[130,0],[0,-100],[-130,0],[0,100]]){
    await until(page,s=>s.combat.player.state==='idle');
    const p=(await snapshot(page)).pose.screen.foxGround;
    await page.mouse.click(p.x+dx,p.y+dy);
    const prep=await until(page,s=>s.combat.player.state==='attack'&&s.combat.player.t>=.075);
    await capture(page,`fox-${index}-prepare`);
    const impact=await until(page,s=>s.combat.player.t>=.16&&s.combat.player.state==='attack');
    await capture(page,`fox-${index}-contact`);
    const follow=await until(page,s=>s.combat.player.t>=.28&&s.combat.player.state==='attack');
    await capture(page,`fox-${index}-follow`);
    expect(local(prep.pose.fox.tip,prep.combat.player).x).toBeLessThan(-1.2);
    expect(local(impact.pose.fox.tip,impact.combat.player).z).toBeGreaterThan(1.7);
    expect(local(follow.pose.fox.tip,follow.combat.player).x).toBeGreaterThan(1.1);
    expect(follow.pose.fox.chestYaw-prep.pose.fox.chestYaw).toBeGreaterThan(.8);
    index++;
  }
});

test('sword contact freezes the strike, then recoils the robot without interrupting its windup',async({page})=>{
  await boot(page);await page.keyboard.down('KeyD');await page.clock.runFor(480);await page.keyboard.up('KeyD');
  await until(page,s=>s.combat.robot.state==='windup'&&s.combat.robot.t>=.10);
  const aim=(await snapshot(page)).pose.screen.robotGround;await page.mouse.click(aim.x,aim.y);
  const impact=await until(page,s=>s.combat.hits>0&&s.pose.hitstop>0);
  expect(impact.combat.robot.state).toBe('windup');
  expect(impact.pose.robot.reaction.strength).toBeGreaterThan(0);
  const tip=local(impact.pose.fox.tip,impact.combat.player);expect(tip.z).toBeCloseTo(1.848,2);
  await capture(page,'contact-hitstop');
  await page.clock.runFor(32);const held=await snapshot(page);
  expect(held.combat.elapsed).toBeCloseTo(impact.combat.elapsed,6);expect(held.pose.fox.tip).toEqual(impact.pose.fox.tip);
  await page.clock.runFor(96);const recoil=await snapshot(page);
  expect(recoil.pose.robot.reaction.age).toBeGreaterThan(0);expect(recoil.combat.robot.state).toBe('windup');
  await capture(page,'robot-recoil');
  if(process.env.ANIMATION_REVIEW_DIR){
  await until(page,s=>s.combat.robot.state==='windup'&&s.combat.robot.t>=.74);await capture(page,'robot-overhead');
  const slam=await until(page,s=>s.combat.robot.state==='strike');
  expect(slam.pose.robot.sole[1]).toBeCloseTo(.085,3);await capture(page,'robot-ground-contact');
  const hurt=await until(page,s=>s.combat.player.hp<100&&s.pose.hitstop>0);
  expect(hurt.pose.fox.reaction.strength).toBeGreaterThan(0);await page.clock.runFor(144);await capture(page,'fox-heavy-recoil');
  await until(page,s=>s.combat.robot.state==='recover'&&s.combat.robot.t>.5);await capture(page,'robot-recovery');
  }
});

test('consecutive hammer impacts stay on the ground after movement and turning',async({page})=>{
  // Run this sequence in real time as a second frame-rate path, without clock control.
  await page.goto('./');await expect.poll(()=>page.evaluate(()=>window.__pustoshBoot?.report.ready)).toBe(true);await page.keyboard.press('Enter');
  const impacts=[];
  for(let i=0;i<3;i++){
    await page.waitForFunction(()=>window.__combatSnapshot().robot.state==='strike');
    const impact=await snapshot(page);impacts.push(impact.combat.robot.angle);expect(impact.pose.robot.sole[1]).toBeCloseTo(.085,3);
    const head=local(impact.pose.robot.head,impact.combat.robot);expect(head.x).toBeCloseTo(0,3);expect(head.z).toBeCloseTo(2.4,3);
    await capture(page,`hammer-${i}-impact`);
    if(i<2){
      await page.waitForFunction(()=>window.__combatSnapshot().robot.state==='recover');
      const key=i===0?'KeyW':'KeyA',before=(await snapshot(page)).combat.player;
      await page.keyboard.down(key);
      await page.waitForFunction(before=>{const p=window.__combatSnapshot().player;return Math.hypot(p.x-before.x,p.z-before.z)>.9;},before,{timeout:15000});
      await page.keyboard.up(key);
      await page.waitForFunction(()=>window.__combatSnapshot().robot.state==='approach');
    }
  }
  expect(Math.max(...impacts)-Math.min(...impacts)).toBeGreaterThan(.12);
});
