/* Isolated browser regression: all auth/backend requests are mocked, no live writes.
   Run with Node and Playwright available (NODE_PATH may point to the bundled packages).
   CHROME_PATH overrides Playwright's bundled Chromium. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const port = 4187, base = `http://127.0.0.1:${port}`;
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',P='44444444-4444-4444-8444-444444444444',CONV='55555555-5555-4555-8555-555555555555';
let vehicles=[], rows=[], failSave=false, lastChat=null, mutations=[];
let quotaResponse={remaining:95,used:5,limit:100,plan_type:'paid',unlimited:false};
const vehicle=(id,brand,model)=>({id,brand,model,generation:'T30',year:2003,engine:'SR20VET',fuel:'Petrol',transmission:'AT',drive:'4WD',mileage:142000,vin:'PNT30-123456',lifecycle_status:'ACTIVE',notes:'Keep owner note'});
const problem={id:P,vehicle_id:A,title:'Uneven idle',status:'IN_PROGRESS',symptoms:['Cold idle unstable'],confirmed_facts:['No ECU errors'],checks_summary:'Air filter checked',hypotheses:[{title:'Air leak'}],next_step:'Inspect intake',created_at:new Date().toISOString()};
const server=spawn(process.execPath,['serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'pipe',windowsHide:true});
let browser;
(async()=>{
  for(let i=0;i<40;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:960}});
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),p=url.pathname;
    const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    if(url.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'text/javascript',body:`window.supabase={createClient(){return {auth:{async getUser(){if(window.__pulsAuthDelayMs)await new Promise(resolve=>setTimeout(resolve,window.__pulsAuthDelayMs));return {data:{user:window.__guest?null:{id:'owner-a',email:'test@example.test'}}}},async getSession(){return {data:{session:window.__guest?null:{access_token:'test-token'}}}},onAuthStateChange(){},async signOut(){window.__guest=true;return {}},async signInWithPassword(){window.__guest=false;return {data:{user:{id:'owner-a',email:'test@example.test'}}}}},from(){const q={select(){return q},eq(){return q},update(){return q},insert(){return q},async maybeSingle(){return {data:{id:'owner-a',email:'test@example.test'}}},async single(){return {data:{id:'owner-a',email:'test@example.test'}}}};return q;}}}};`});
    if(url.hostname!=='127.0.0.1')return route.fulfill({status:200,body:''});
    if(!p.startsWith('/api/'))return route.continue();
    if(p==='/api/vehicles/enrich')return route.fulfill({status:404,body:'Identifier not recognized'});
    assert.equal(request.headers().authorization,'Bearer test-token',`auth: ${p}`);
    if(request.method()!=='GET')mutations.push({path:p,method:request.method()});
    if(p==='/api/quota')return json({quota:quotaResponse});
    if(p==='/api/history'||p.startsWith('/api/conversations/'))return json({items:rows});
    if(p==='/api/chat'){
      lastChat=request.postDataJSON();const now=new Date().toISOString();
      if(!lastChat.conversation_id)rows=[];
      rows.push({id:'u',role:'USER',content:lastChat.message,conversation_id:CONV,vehicle_id:lastChat.vehicle_id||null,problem_id:lastChat.problem_id||null,created_at:now},{id:'a',role:'ASSISTANT',content:'Check the intake safely.',conversation_id:CONV,vehicle_id:lastChat.vehicle_id||null,problem_id:lastChat.problem_id||null,created_at:now});
      return json({conversation_id:CONV,vehicle_id:lastChat.vehicle_id||null,problem_id:lastChat.problem_id||null,answer:'Check the intake safely.',quota:{remaining:2,limit:5}});
    }
    if(p===`/api/problems/${P}`)return json({problem,vehicle:vehicles.find(v=>v.id===A),sources:[{extracted_evidence:'Confirmed forum case',sources:{title:'Technical forum thread',url:'https://example.test/peugeot-thread',domain:'example.test'}}]});
    if(p==='/api/vehicles'&&request.method()==='GET')return json({vehicles:url.searchParams.has('include_trashed')?vehicles:vehicles.filter(v=>v.lifecycle_status==='ACTIVE')});
    if(p==='/api/vehicles'&&request.method()==='POST'){
      if(failSave)return route.fulfill({status:503,body:'Unavailable'});
      const v={...request.postDataJSON(),id:vehicles.length?B:C,lifecycle_status:'ACTIVE'};vehicles.push(v);return json({vehicle:v});
    }
    const id=p.split('/')[3],v=vehicles.find(v=>v.id===id);
    if(p.endsWith('/problems'))return json({problems:id===A?[problem]:[]});
    if(p.endsWith('/timeline'))return json({events:id===A?[{id:'event-a',vehicle_id:A,event_type:'maintenance',title:'Engine oil replaced',description:'Owner record',mileage:141000,occurred_at:new Date().toISOString()}]:[]});
    if(p.endsWith('/restore')){v.lifecycle_status='ACTIVE';return json({vehicle:v});}
    if(v&&request.method()==='DELETE'){v.lifecycle_status='TRASHED';v.restore_until=new Date(Date.now()+30*86400000).toISOString();return json({deleted:true});}
    if(v&&request.method()==='PUT'){Object.assign(v,request.postDataJSON());return json({vehicle:v});}
    if(v)return json({vehicle:v,specs:{vehicle_id:id,items:[{parameter_key:'displacement',actual_value:'2.0 L'},{parameter_key:'power',actual_value:'206 kW'}]}});
    return route.fulfill({status:404,body:'No fixture'});
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  async function open(){await page.goto(base);await page.waitForFunction(()=>window.pulsCurrentUser?.id==='owner-a');await page.locator('#pulsSplashHitArea').click();await page.waitForTimeout(150);}
  const clickNav=view=>page.locator(`.nav [data-view="${view}"]`).click();
  await open();await clickNav('car');
  await page.waitForFunction(()=>document.querySelector('#systemPill').textContent.includes('95 of 100'));
  await clickNav('settings');
  assert.equal(await page.locator('#settingsSubscriptionStatus').innerText(),'Status: Paid — 95 of 100 requests remaining');
  quotaResponse={remaining:5,used:0,limit:5,plan_type:'free',unlimited:false};
  await page.reload();await page.locator('#pulsSplashHitArea').click();await clickNav('settings');
  await page.waitForFunction(()=>document.querySelector('#settingsSubscriptionStatus').textContent.includes('5 of 5'));
  assert.equal(await page.locator('#settingsSubscriptionStatus').innerText(),'Status: Free — 5 of 5 requests remaining');
  await clickNav('car');
  await page.locator('#carEmpty').waitFor({state:'visible'});
  assert.equal(await page.locator('.nav [data-view="history"],.nav [data-view="journal"],#journal,#history').count(),0);
  await page.locator('#carEmpty [data-car-action="add"]').click();
  await page.locator('#carVinInput').fill('PNT30-123456');
  await page.locator('#carLookupBtn').click();
  await page.waitForFunction(()=>document.querySelector('#carLookupStatus').textContent.includes('manually'));
  assert.equal(await page.locator('#carVinInput').inputValue(),'PNT30-123456');
  await page.locator('#carBrandInput').fill('Nissan');await page.locator('#carModelInput').fill('X-Trail');
  failSave=true;await page.locator('#carSaveBtn').click();await page.waitForFunction(()=>document.querySelector('#carFormStatus').textContent.includes('Could not save'));
  assert.equal(vehicles.length,0);failSave=false;await page.locator('#carSaveBtn').click();await page.locator('#carVehicle').waitFor({state:'visible'});
  assert.equal(vehicles[0].vin,'PNT30-123456');
  await page.locator('#vehicleSwitcher [data-car-action="add"]').click();
  await page.locator('#carBrandInput').fill('Toyota');await page.locator('#carModelInput').fill('Crown');
  // Verify creating a second car retains the first rather than replacing its UI record.
  await page.locator('#carSaveBtn').click();await page.locator('#carVehicle').waitFor({state:'visible'});
  assert.equal(vehicles.length,2);
  assert.equal(await page.locator('[data-car-vehicle]').count(),2);
  vehicles=[vehicle(A,'Nissan','X-Trail'),vehicle(B,'Toyota','Crown')];
  await page.reload();await page.locator('#pulsSplashHitArea').click();await clickNav('car');
  await page.locator('[data-car-problem]').first().waitFor();
  await page.locator('[data-car-vehicle="'+B+'"]').click();
  await page.waitForFunction(()=>document.querySelector('#vehicleProblems').textContent.includes('No active'));
  assert(!await page.locator('#carVehicle').innerText().then(s=>s.includes('Uneven idle')));
  await page.locator('[data-car-vehicle="'+A+'"]').click();
  await page.locator('[data-car-tab="data"]').click();
  await page.waitForFunction(()=>document.querySelector('#vehicleData').textContent.includes('2.0 L'));
  await page.locator('.vehicle-actions summary').click();await page.locator('[data-car-action="edit"]').click();
  assert.equal(await page.locator('#specPower').inputValue(),'206 kW');
  await page.locator('#carGenerationInput').fill('Owner chassis');await page.locator('#carSaveBtn').click();await page.locator('#carVehicle').waitFor({state:'visible'});
  assert.equal(vehicles.find(v=>v.id===A).notes,'Keep owner note');assert.equal(vehicles.find(v=>v.id===A).power,'206 kW');
  await page.locator('[data-car-tab="history"]').click();await page.locator('[data-car-filter="maintenance"]').click();
  assert((await page.locator('#vehicleHistory').innerText()).includes('Engine oil replaced'));
  await page.locator('[data-car-tab="overview"]').click();
  await page.locator('#vehicleProblems [data-car-problem]').click();await page.locator('[data-car-action="continue"]').waitFor();
  assert((await page.locator('#vehicleDialogContent').innerText()).includes('Air filter checked'));
  assert((await page.locator('#vehicleDialogContent').innerText()).includes('Technical forum thread'));
  assert.equal(await page.locator('#vehicleDialogContent .request-link').getAttribute('href'),'https://example.test/peugeot-thread');
  await page.locator('[data-car-action="continue"]').click();
  assert(await page.locator('#assistant').evaluate(n=>n.classList.contains('active')));
  await page.locator('#promptInput').fill('What should I inspect?');await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>!window.PulsChat.sending&&document.querySelector('#messages').textContent.includes('Check the intake'));
  assert.equal(lastChat.vehicle_id,A);assert.equal(lastChat.problem_id,P);
  await page.locator('#promptInput').fill('The intake looks intact');await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>!window.PulsChat.sending&&document.querySelectorAll('#messages .bubble').length===4);
  assert.equal(lastChat.conversation_id,CONV);
  await page.reload();await page.locator('#pulsSplashHitArea').click();
  await page.waitForFunction(()=>document.querySelectorAll('#messages .bubble').length===4);
  // A clean browser has no local/session state and may restore auth later than app startup.
  await page.addInitScript(()=>{
    const marker='puls-auth-delay-tested';
    window.__pulsAuthDelayMs=window.name.includes(marker)?0:250;
    if(window.__pulsAuthDelayMs)window.name=`${window.name} ${marker}`.trim();
  });
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
  await page.waitForFunction(()=>document.querySelectorAll('#messages .bubble').length===4);
  await page.waitForTimeout(50);await page.locator('#pulsSplashHitArea').click();
  const restoredFromServer=await page.evaluate(()=>JSON.parse(localStorage.getItem('puls_current_chat_v2:owner-a')));
  assert.equal(restoredFromServer.conversationId,CONV);
  // A stale browser-only problem marker must not suppress canonical discovery after reload.
  await page.evaluate(({vehicleId,problemId})=>localStorage.setItem('puls_current_chat_v2:owner-a',JSON.stringify({conversationId:null,vehicleId,problemId,lastActivity:0})),{vehicleId:A,problemId:P});
  await page.reload();
  await page.waitForFunction(()=>document.querySelectorAll('#messages .bubble').length===4);
  await page.waitForTimeout(50);await page.locator('#pulsSplashHitArea').click();
  const restoredPastStaleMarker=await page.evaluate(()=>JSON.parse(localStorage.getItem('puls_current_chat_v2:owner-a')));
  assert.equal(restoredPastStaleMarker.conversationId,CONV);
  await clickNav('settings');await clickNav('assistant');
  await page.waitForFunction(()=>document.querySelectorAll('#messages .bubble').length===4);
  await clickNav('car');await clickNav('assistant');
  await page.waitForFunction(()=>document.querySelectorAll('#messages .bubble').length===4);
  const geometry=await page.locator('#messages').evaluate(n=>({top:n.getBoundingClientRect().top,overflow:getComputedStyle(n).overflowY,height:n.clientHeight}));
  assert(geometry.top<260);assert.equal(geometry.overflow,'auto');assert(geometry.height>200);
  if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.waitForTimeout(750);await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'chat-desktop.png')});}
  await page.setViewportSize({width:390,height:844});
  const inputBounds=await page.locator('#promptInput').boundingBox();assert(inputBounds.y+inputBounds.height<=844);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'chat-mobile.png')});
  await page.setViewportSize({width:1440,height:960});
  const marker=await page.evaluate(()=>JSON.parse(localStorage.getItem('puls_current_chat_v2:owner-a')));
  assert.equal(marker.conversationId,CONV);assert(!JSON.stringify(marker).includes('inspect'));
  const ttl=await page.evaluate(()=>{
    const now=Date.now(),row=hours=>({role:'user',message_text:'x',conversation_id:'c',created_at:new Date(now-hours*3600000).toISOString()});
    return [0,0.5,5,12,13].map(h=>window.PulsChat.sessionRows([row(h)],now).length);
  });assert.deepEqual(ttl,[1,1,1,0,0]);
  rows=rows.map(r=>({...r,created_at:new Date(Date.now()-13*3600000).toISOString()}));
  await page.reload();await page.locator('#pulsSplashHitArea').click();await page.locator('.chat-empty-state').waitFor();assert.equal(rows.length,4);
  await page.locator('#promptInput').fill('New session');await page.locator('#sendBtn').click();
  await page.waitForFunction(()=>!window.PulsChat.sending&&document.querySelector('#messages').textContent.includes('Check the intake'));
  assert.equal(lastChat.conversation_id,undefined);
  await clickNav('car');await page.locator('.vehicle-actions summary').click();await page.locator('[data-car-action="trash"]').click();
  assert.equal(vehicles[0].lifecycle_status,'ACTIVE');await page.locator('[data-car-action="confirm-trash"]').click();await page.waitForFunction(()=>!document.querySelector('#vehicleDialog').open);
  assert.equal(vehicles[0].lifecycle_status,'TRASHED');await page.locator('#carTrash').click();await page.locator('[data-car-restore]').click();await page.waitForFunction(()=>!document.querySelector('#vehicleDialog').open);
  assert.equal(vehicles[0].lifecycle_status,'ACTIVE');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('#mobileNavToggle').isVisible(),true);
  await page.locator('#mobileNavToggle').click();await clickNav('car');
  assert.equal(await page.locator('#mobileNavToggle').getAttribute('aria-expanded'),'false');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const shots=process.env.SCREENSHOT_DIR;
  if(shots){fs.mkdirSync(shots,{recursive:true});await page.locator(`[data-car-vehicle="${A}"]`).click();await page.locator('#vehicleProblems [data-car-problem]').waitFor();await page.screenshot({path:path.join(shots,'my-car-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:960});await page.screenshot({path:path.join(shots,'my-car-desktop.png'),fullPage:true});}
  await page.evaluate(async()=>{window.__guest=true;await window.updateProfileBlock();});
  await page.waitForFunction(()=>!window.pulsCurrentUser);
  assert.equal(await page.locator('#messages .bubble').count(),0);
  await page.evaluate(()=>showView('settings'));await page.locator('#authBtn').click();
  await page.locator('#authEmail').fill('test@example.test');await page.locator('#authPassword').fill('test-password');await page.locator('#loginBtn').click();
  await page.waitForFunction(()=>window.pulsCurrentUser?.id==='owner-a');
  await page.waitForFunction(()=>!document.querySelector('#authModal').classList.contains('show'));
  assert.deepEqual(errors,[]);
  assert(!mutations.some(m=>/history|messages|conversations/.test(m.path)));
  console.log('PASS: paid/free Settings subscription, startup, auth/logout, empty/manual/VIN failure/save failure/create, multiple vehicles and isolation, tabs/specs/timeline, structured problem sources + chat context, F5 restore, 12h expiry, chat viewport, trash/restore, mobile navigation/overflow. No live writes.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.kill();});
