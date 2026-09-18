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
const events = [
  { sequence: 1, offset_ms: 0, event_type: 'REQUEST', operation: 'CONTEXT', status: 'STARTED', from_node: 'USER', to_node: 'API', edge_label: 'REQUEST', input_data: { message_excerpt: 'АКПП' } },
  { sequence: 2, offset_ms: 120, event_type: 'DATABASE', operation: 'READ', status: 'COMPLETED', from_node: 'vehicle_specs', to_node: 'Context', table_name: 'vehicle_specs' },
  { sequence: 3, offset_ms: 240, event_type: 'KNOWLEDGE', operation: 'READ', status: 'COMPLETED', from_node: 'Context', to_node: 'Knowledge', edge_label: 'MISS' },
  { sequence: 4, offset_ms: 400, event_type: 'SEARCH_STAGE', operation: 'SEARCH', status: 'COMPLETED', from_node: 'Search Episode', to_node: 'Stage 4', edge_label: 'forums', stage_number: 4, source_group: 'forums' },
  { sequence: 5, offset_ms: 520, event_type: 'SOURCE', operation: 'RESULT', status: 'COMPLETED', from_node: 'Stage 4', to_node: 'Sources', output_data: { title: 'AL4 forum', url: 'https://example.test/al4', retained: true } },
  { sequence: 6, offset_ms: 650, event_type: 'IMAGE', operation: 'VERIFY', status: 'SKIPPED', from_node: 'Image Candidates', to_node: 'Rejected Images', output_data: { title: 'PULS logo', reason: 'branding_asset' } },
  { sequence: 7, offset_ms: 800, event_type: 'ANSWER', operation: 'RESULT', status: 'COMPLETED', from_node: 'API', to_node: 'USER', edge_label: 'ANSWER' },
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
    if (pathname === '/admin/knowledge/live-flow/traces' && !pathname.includes('trace-1')) return json({ items: [{ id: 'trace-1', status: 'COMPLETED', intent: 'DIAGNOSTIC', user_label: 'owner@test.local', vehicle_id: 'v1', message_excerpt: 'АКПП плохо едет', started_at: '2026-09-19T12:00:00Z', duration_ms: 800 }] });
    if (pathname === '/admin/knowledge/live-flow/traces/trace-1') return json({ id: 'trace-1', status: 'COMPLETED', events });
    return json({});
  });
  const page = await context.newPage();
  await page.goto(`${base}/admin.html#live-flow`);
  await page.locator('[data-flow-trace="trace-1"]').click();
  await page.waitForFunction(() => Number(document.querySelector('#flowScrubber')?.max || 0) === 6);
  await page.locator('#flowScrubber').fill('3');
  await page.locator('#flowGraph [data-flow-node="Stage 4"]').waitFor();
  assert.equal(await page.locator('.flow-edge').count(), 4);
  await page.locator('#flowPlay').click(); await page.waitForTimeout(160);
  assert.ok(Number(await page.locator('#flowScrubber').inputValue()) >= 1);
  await page.locator('#flowPause').click();
  await page.locator('#flowSpeed').selectOption('4'); assert.equal(await page.locator('#flowSpeed').inputValue(), '4');
  await page.locator('#flowScrubber').fill('5');
  assert.match(await page.locator('#flowInspector').textContent(), /branding_asset/);
  await page.locator('#flowRestart').click(); assert.equal(await page.locator('#flowScrubber').inputValue(), '0');
  assert.match(await page.locator('#flowMedia').textContent(), /PULS logo/);
  assert.equal(calls.some((call) => /chat|search|parser/i.test(call)), false, 'Replay must not invoke business/provider APIs');
  assert.equal(calls.every((call) => call.startsWith('GET ')), true);
  console.log('Admin Live Request Flow mocked regression passed.');
})().finally(async () => { if (browser) await browser.close(); server.kill(); }).catch((error) => { console.error(error); process.exitCode = 1; });
