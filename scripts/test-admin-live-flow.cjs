/* Deterministic Live Request Flow browser regression. All API/auth/provider data is mocked. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = 4191;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'pipe', windowsHide: true });
let browser;
const rawSearchEvents = [
  ['REQUEST','CONTEXT','STARTED','USER','API','REQUEST'], ['AUTH','VERIFY','COMPLETED','API','User Context','AUTH'],
  ['DATABASE','READ','COMPLETED','vehicles','Context','READ'], ['CLASSIFIER','RESULT','COMPLETED','Context','Classifier','HOWTO'],
  ['CONTEXT','RESULT','COMPLETED','Classifier','Conversation','CONTEXT'], ['KNOWLEDGE','READ','COMPLETED','Context','Knowledge','MISS'],
  ['SEARCH','CONTEXT','COMPLETED','Knowledge','Search Episode','MISS → SEARCH'], ['SEARCH_EPISODE','WRITE','COMPLETED','Search Episode','search_episodes','WRITE'],
  ['SEARCH_STAGE','SEARCH','STARTED','Search Episode','Stage 1','video'], ['SOURCE_GROUP','CONTEXT','COMPLETED','Stage 1','video','SOURCE GROUP'],
  ['PROVIDER','SEARCH','STARTED','video','Claude','PROVIDER'], ['SEARCH_STAGE','RESULT','COMPLETED','Claude','Sources','3 SOURCES'],
  ['SOURCE','RESULT','COMPLETED','Stage 1','Sources','SOURCE'], ['DATABASE','WRITE','COMPLETED','Sources','sources','WRITE'],
  ['EVIDENCE','EVIDENCE','COMPLETED','Sources','Evidence','SUFFICIENT_EVIDENCE'], ['LLM','RESULT','COMPLETED','Evidence','LLM','SYNTHESIS'],
  ['DATABASE','WRITE','COMPLETED','Sources','problem_sources','WRITE'], ['SEARCH_EPISODE','RESULT','COMPLETED','LLM','ANSWER','SUFFICIENT_EVIDENCE'],
  ['DATABASE','WRITE','COMPLETED','ANSWER','messages','WRITE'], ['ANSWER','RESULT','COMPLETED','API','USER','ANSWER'],
  ['IMAGE','RESULT','COMPLETED','Sources','Image Candidates','CANDIDATE'], ['IMAGE','VERIFY','SKIPPED','Image Candidates','Rejected Images','BRANDING_ASSET'],
  ['SOURCE','VERIFY','COMPLETED','sources','Evidence','RETAINED'], ['DATABASE','READ','COMPLETED','search_runs','Evidence','READ'],
  ['DATABASE','VERIFY','COMPLETED','messages','ANSWER','VERIFY'], ['SOURCE','RESULT','COMPLETED','Stage 1','Sources','YouTube'],
  ['DATABASE','WRITE','COMPLETED','Sources','sources','WRITE'], ['EVIDENCE','RESULT','WARNING','Evidence','LLM','PRELIMINARY'],
  ['LLM','RESULT','COMPLETED','LLM','ANSWER','FORMAT'], ['DATABASE','WRITE','COMPLETED','ANSWER','messages','WRITE'],
  ['DATABASE','VERIFY','COMPLETED','messages','ANSWER','VERIFY'], ['ANSWER','RESULT','COMPLETED','ANSWER','USER','DELIVERED'],
];
const searchEvents = rawSearchEvents.map(([event_type,operation,status,from_node,to_node,edge_label],index) => ({
  sequence:index+1,offset_ms:index*110,event_type,operation,status,from_node,to_node,edge_label,
  ...(to_node==='vehicles'||from_node==='vehicles'?{table_name:'vehicles'}:{}),
  ...(['search_episodes','search_runs','sources','problem_sources','messages'].includes(to_node)?{table_name:to_node}:{}),
  ...(event_type==='SOURCE'?{output_data:{title:'YouTube AL4 level check',url:'https://youtube.example.test/al4',retained:true}}:{}),
  ...(edge_label==='BRANDING_ASSET'?{output_data:{title:'PULS logo',reason:'branding_asset'}}:{}),
  ...(to_node==='Stage 1'?{stage_number:1,source_group:'video'}:{}),
  ...(to_node==='Claude'?{provider:'Claude'}:{}),
}));
const fastEvents = [
  {sequence:1,offset_ms:0,event_type:'REQUEST',operation:'CONTEXT',status:'STARTED',from_node:'USER',to_node:'API',edge_label:'REQUEST'},
  {sequence:2,offset_ms:80,event_type:'AUTH',operation:'VERIFY',status:'COMPLETED',from_node:'API',to_node:'User Context',edge_label:'AUTH'},
  {sequence:3,offset_ms:150,event_type:'CLASSIFIER',operation:'RESULT',status:'COMPLETED',from_node:'Context',to_node:'Classifier',edge_label:'GENERAL_CHAT'},
  {sequence:4,offset_ms:230,event_type:'CONTEXT',operation:'RESULT',status:'COMPLETED',from_node:'Classifier',to_node:'Conversation',edge_label:'CONTEXT'},
  {sequence:5,offset_ms:340,event_type:'LLM',operation:'RESULT',status:'COMPLETED',from_node:'Conversation',to_node:'LLM',edge_label:'FAST CHAT'},
  {sequence:6,offset_ms:420,event_type:'DATABASE',operation:'WRITE',status:'COMPLETED',from_node:'ANSWER',to_node:'messages',edge_label:'WRITE',table_name:'messages'},
  {sequence:7,offset_ms:500,event_type:'ANSWER',operation:'RESULT',status:'COMPLETED',from_node:'ANSWER',to_node:'USER',edge_label:'ANSWER'},
];

(async () => {
  for (let i = 0; i < 40; i += 1) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const calls = [];
  await context.route('**/*', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const pathname = url.pathname;
    if (url.hostname === 'cdn.jsdelivr.net') return route.fulfill({ contentType: 'text/javascript', body: `window.supabase={createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:'fixture-token',user:{email:'admin@puls.test'}}},error:null})}}}};` });
    if (url.hostname !== '127.0.0.1' || !pathname.startsWith('/admin/')) return route.continue();
    calls.push(`${request.method()} ${pathname}`); assert.equal(request.headers().authorization, 'Bearer fixture-token');
    const json = (value) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) });
    if (pathname === '/admin/users') return json({ users: [] });
    if (pathname === '/admin/knowledge/live-flow/traces') return json({ items: [
      { id: 'trace-search', status: 'COMPLETED', intent: 'HOWTO', user_label: 'owner@test.local', vehicle_id: 'v1', message_excerpt: 'YouTube manual', started_at: '2026-09-19T12:00:00Z', duration_ms: 3410 },
      { id: 'trace-fast', status: 'COMPLETED', intent: 'GENERAL_CHAT', user_label: 'owner@test.local', vehicle_id: 'v1', message_excerpt: 'Hello', started_at: '2026-09-19T11:00:00Z', duration_ms: 500 },
    ] });
    if (pathname === '/admin/knowledge/live-flow/traces/trace-search') return json({ id: 'trace-search', status: 'COMPLETED', events:searchEvents });
    if (pathname === '/admin/knowledge/live-flow/traces/trace-fast') return json({ id: 'trace-fast', status: 'COMPLETED', events:fastEvents });
    return json({});
  });
  const page = await context.newPage();
  await page.goto(`${base}/admin.html#live-flow`);
  await page.locator('[data-flow-trace="trace-search"]').click();
  await page.waitForFunction(() => Number(document.querySelector('#flowScrubber')?.max || 0) === 31);
  await page.locator('#flowScrubber').fill('3');
  await page.locator('#flowGraph [data-flow-node="Classifier"]').waitFor();
  assert.equal(await page.locator('.flow-edge').count(), 4);
  await page.locator('#flowPlay').click(); await page.waitForTimeout(160);
  assert.ok(Number(await page.locator('#flowScrubber').inputValue()) >= 1);
  await page.locator('#flowPause').click();
  await page.locator('#flowSpeed').selectOption('4'); assert.equal(await page.locator('#flowSpeed').inputValue(), '4');
  await page.locator('#flowScrubber').fill('21');
  assert.match(await page.locator('#flowInspector').textContent(), /branding_asset/);
  await page.locator('#flowRestart').click(); assert.equal(await page.locator('#flowScrubber').inputValue(), '0');
  assert.match(await page.locator('#flowMedia').textContent(), /PULS logo/);
  await page.locator('#flowScrubber').fill('16');
  await page.locator('#flowGraphMode').click();
  assert.equal(await page.locator('#flowScrubber').inputValue(),'16');
  await page.locator('.architecture-graph').waitFor();
  assert.equal(await page.locator('.architecture-node[data-flow-node="Stage 1"]').count(),1);
  assert.equal(await page.locator('.architecture-node.is-db[data-flow-node="vehicles"]').count(),1);
  assert.ok(await page.locator('.architecture-edge.is-future').count()>0);
  assert.equal(await page.locator('.architecture-edge.is-active animateMotion').count(),1);
  await page.locator('#flowPlay').click();await page.waitForTimeout(160);await page.locator('#flowPause').click();
  assert.ok(Number(await page.locator('#flowScrubber').inputValue())>16);
  await page.locator('#flowScrubber').fill('21');assert.equal(await page.locator('.architecture-edge.is-skipped').count(),1);
  await page.locator('#flowScrubber').fill('27');assert.equal(await page.locator('.architecture-edge.is-warning').count(),1);
  await page.locator('#flowScrubber').fill('16');
  await page.locator('.architecture-node[data-flow-node="Sources"]').click();
  assert.match(await page.locator('#flowInspector').textContent(),/related_events/);
  const synchronizedIndex=await page.locator('#flowScrubber').inputValue();
  await page.locator('#flowTraceMode').click();
  assert.equal(await page.locator('#flowScrubber').inputValue(),synchronizedIndex);
  await page.locator('[data-flow-trace="trace-fast"]').click();
  await page.locator('#flowGraphMode').click();
  assert.equal(await page.locator('.architecture-node[data-flow-node="Search Episode"]').count(),0);
  assert.equal(await page.locator('.architecture-node[data-flow-node^="Stage "]').count(),0);
  assert.equal(calls.some((call) => /\/(chat|search|parser)(?:\/|$)/i.test(call)), false, 'Replay must not invoke business/provider APIs');
  assert.equal(calls.every((call) => call.startsWith('GET ')), true);
  console.log('Admin Live Request Flow mocked regression passed.');
})().finally(async () => { if (browser) await browser.close(); server.kill(); }).catch((error) => { console.error(error); process.exitCode = 1; });
