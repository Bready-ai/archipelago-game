import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('./');
  await expect.poll(()=>page.evaluate(()=>window.__pustoshBoot?.report.ready)).toBe(true);
  await expect(page.locator('#fatal')).toBeHidden();
}
async function report(page) { return page.evaluate(()=>window.__pustoshBoot.report); }
async function failed(page) {
  await page.goto('./');
  await expect(page.locator('#fatal')).toBeVisible();
  return report(page);
}

test('production scene renders WebGL 2 and handles three simultaneous touches',async({page,context})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&['script','stylesheet','font'].includes(r.request().resourceType()))errors.push(r.url());});
  await ready(page);
  expect((await report(page)).context.version).toContain('WebGL 2');
  await page.locator('#start').tap();
  const snapshot=()=>page.evaluate(()=>window.__combatSnapshot());
  const cdp=await context.newCDPSession(page);
  const center=async(selector,id)=>{const b=await page.locator(selector).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2,id};};
  const move=await center('#joystick',1);move.x+=40;
  const attack=await center('#touch-attack',2),dodge=await center('#touch-dodge',3);
  const send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const before=(await snapshot()).player;
  await send('touchStart',[move]);await send('touchStart',[move,attack]);
  await expect.poll(async()=>{const s=await snapshot();return s.mobile.attackHeld&&s.mobile.movement.x>.1&&Math.hypot(s.player.x-before.x,s.player.z-before.z)>.1;}).toBe(true);
  // The committed windup cannot be cancelled; press during the allowed recovery window.
  await page.waitForFunction(()=>{const p=window.__combatSnapshot().player;return p.state==='attack'&&p.t>=.30&&p.t<=.45;});
  const dodgesBefore=(await snapshot()).dodges;
  await send('touchStart',[move,attack,dodge]);
  await expect.poll(async()=>(await snapshot()).dodges).toBeGreaterThan(dodgesBefore);
  await send('touchCancel',[]);
  await expect.poll(async()=>{const s=await snapshot();return !s.mobile.attackHeld&&s.mobile.movement.x===0;}).toBe(true);
  await page.setViewportSize({width:390,height:844});
  await expect.poll(async()=>(await snapshot()).mode).toBe('paused');
  await page.locator('#resume').tap();
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
  expect(errors).toEqual([]);
});

test('startup does not force a high-performance GPU profile',async({page})=>{
  await page.addInitScript(()=>{
    const native=HTMLCanvasElement.prototype.getContext;
    window.contextRequests=[];
    HTMLCanvasElement.prototype.getContext=function(type,attrs){
      if(type==='webgl2'){
        window.contextRequests.push(attrs||{});
        if(attrs?.powerPreference==='high-performance')return null;
      }
      return native.call(this,type,attrs);
    };
  });
  await ready(page);
  expect(await page.evaluate(()=>window.contextRequests.some(a=>a.powerPreference==='high-performance'))).toBe(false);
  expect((await report(page)).attempts[0].status).toBe('success');
});

test('driver rejecting selected attributes recovers with browser-default WebGL 2',async({page})=>{
  await page.addInitScript(()=>{
    const native=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,attrs){
      if(type==='webgl2'&&attrs){this.dispatchEvent(new WebGLContextEvent('webglcontextcreationerror',{statusMessage:'Driver rejected selected attributes'}));return null;}
      return native.call(this,type,attrs);
    };
  });
  await ready(page);
  const r=await report(page);
  expect(r.attempts.map(a=>a.status)).toEqual(['failed','failed','success']);
  expect(r.attempts[0].statusMessage).toBe('Driver rejected selected attributes');
  expect(r.context.profile).toBe('browser-defaults');
  expect(await page.evaluate(()=>window.__combatSnapshot().drawCalls)).toBeGreaterThan(0);
});

test('missing highp precision report still renders with supported mediump',async({page})=>{
  await page.addInitScript(()=>{
    const native=WebGL2RenderingContext.prototype.getShaderPrecisionFormat;
    WebGL2RenderingContext.prototype.getShaderPrecisionFormat=function(shader,type){return type===this.HIGH_FLOAT?null:native.call(this,shader,type);};
  });
  await ready(page);
  expect((await report(page)).context.precision).toBe('mediump');
});

test('a Three.js initialization exception keeps its name, stack and working-context evidence',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.addInitScript(()=>{
    const native=WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter=function(key){
      if(key===this.MAX_TEXTURE_IMAGE_UNITS)throw new TypeError('Reproduced renderer capability failure');
      return native.call(this,key);
    };
  });
  const r=await failed(page);
  expect(r.phase).toBe('three-renderer');expect(r.failure.name).toBe('TypeError');
  expect(r.failure.message).toBe('Reproduced renderer capability failure');
  expect(r.failure.stack).toContain('getParameter');
  expect(r.attempts[0].contextCreated).toBe(true);
  await page.locator('#diagnostic-copy').click();
  await expect(page.locator('#diagnostic-copy-status')).toHaveText('Диагностика скопирована.');
  const copied=JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()));
  expect(copied.failure.message).toBe(r.failure.message);expect(copied.build).toBeTruthy();
});

test('all context failures show browser status and support copying without Clipboard API',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.addInitScript(()=>{
    navigator.clipboard.writeText=()=>Promise.reject(new Error('Clipboard API blocked'));
    const native=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,attrs){
      if(type==='webgl2'){this.dispatchEvent(new WebGLContextEvent('webglcontextcreationerror',{statusMessage:'GPU context temporarily unavailable'}));return null;}
      return native.call(this,type,attrs);
    };
  });
  const r=await failed(page);
  expect(r.phase).toBe('webgl2-context');expect(r.attempts).toHaveLength(3);
  expect(r.failure.message).toBe('GPU context temporarily unavailable');
  await page.locator('#diagnostic-copy').click();
  await expect(page.locator('#diagnostic-copy-status')).toHaveText('Диагностика скопирована.');
  expect(JSON.parse(await page.evaluate(()=>navigator.clipboard.readText())).attempts).toHaveLength(3);
});

test('a missing production game module is diagnosed before Three.js starts',async({page})=>{
  await page.route('**/assets/main-*.js',route=>route.abort());
  const r=await failed(page);
  expect(r.ready).toBe(false);expect(r.attempts).toHaveLength(0);
  expect(r.failure.message).toMatch(/fetch|load|import|загруз/i);
  expect(r.phase).toMatch(/game-modules|asset-loading/);
});

test('a lost context reports the actual event and pauses the fight',async({page})=>{
  await ready(page);await page.locator('#start').tap();
  await page.evaluate(()=>document.querySelector('#scene canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.locator('#fatal')).toBeVisible();
  expect((await report(page)).phase).toBe('context-lost');
  expect(await page.evaluate(()=>window.__combatSnapshot().mode)).toBe('paused');
});

test('desktop mouse and keyboard remain available',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage();
  await ready(page);await page.keyboard.press('Enter');
  const before=await page.evaluate(()=>window.__combatSnapshot().player);
  await page.keyboard.down('KeyW');
  await expect.poll(()=>page.evaluate(before=>{const p=window.__combatSnapshot().player;return Math.hypot(p.x-before.x,p.z-before.z);},before)).toBeGreaterThan(.3);
  await page.keyboard.up('KeyW');await page.mouse.click(750,360);
  await expect.poll(()=>page.evaluate(()=>window.__combatSnapshot().player.state)).toBe('attack');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>window.__combatSnapshot().mode)).toBe('paused');
  await context.close();
});
