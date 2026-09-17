/* Deterministic Admin Data Inspector browser regression. All backend/auth data is mocked. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = 4188;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['serve.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'pipe',
  windowsHide: true,
});

let browser;
(async () => {
  for (let i = 0; i < 40; i += 1) {
    try { if ((await fetch(base)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const requested = [];
  const mutations = [];

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const json = (data) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });

    if (url.hostname === 'cdn.jsdelivr.net') {
      return route.fulfill({
        contentType: 'text/javascript',
        body: `window.supabase={createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:'fixture-token',user:{email:'admin@puls.test'}}},error:null})}}}};`,
      });
    }
    if (url.hostname !== '127.0.0.1' || !pathname.startsWith('/admin/')) {
      return route.continue();
    }

    requested.push(pathname);
    assert.equal(request.headers().authorization, 'Bearer fixture-token');
    if (request.method() !== 'GET') mutations.push(`${request.method()} ${pathname}`);

    if (pathname === '/admin/users') {
      return json({ users: [{
        user_id: 'u1', email: 'admin@puls.test', name: 'Admin', plan: 'paid',
        quota_used: 5, quota_limit: 100, vehicles_count: 4,
      }] });
    }
    if (pathname === '/admin/knowledge/overview') {
      return json({
        counts: {
          conversations: 1, messages: 2, problems: 1, vehicle_events: 1,
          search_episodes: 1, search_runs: 1, sources: 1, problem_sources: 1,
          knowledge_items: 1, knowledge_sources: 1, fleet_events: 1,
        },
        recent_conversations: [],
      });
    }
    if (pathname === '/admin/knowledge/conversations') {
      return json({ items: [{
        id: 1, title: 'Noise diagnosis', status: 'active', message_count: 2,
        user: { email: 'owner@test.local' }, vehicle: { brand: 'Nissan', model: 'X-Trail' },
      }], total: 1, limit: 25, offset: 0 });
    }
    if (pathname === '/admin/knowledge/conversations/1/messages') {
      return json({ items: [
        { id: 1, role: 'USER', message_text: 'Cold start noise' },
        { id: 2, role: 'ASSISTANT', message_text: 'Check timing chain tension.' },
      ], total: 2, limit: 100, offset: 0 });
    }
    if (pathname === '/admin/knowledge/search-episodes') {
      return json({ items: [{ id: 4, status: 'COMPLETED', reason: 'insufficient internal evidence' }], total: 1, limit: 25, offset: 0 });
    }
    if (pathname === '/admin/knowledge/search-episodes/4/runs') {
      return json({ items: [{ id: 5, stage_number: 1, status: 'COMPLETED', run_type: 'web', sufficient_evidence: true }], total: 1, limit: 50, offset: 0 });
    }
    if (pathname === '/admin/knowledge/problems') {
      return json({ items: [{ id: 7, title: 'Cold start noise', problem_class: 'OTHER', status: 'OPEN' }], total: 1, limit: 25, offset: 0 });
    }
    if (pathname === '/admin/knowledge/problems/7/trace') {
      return json({ problem: { id: 7 }, conversations: [], messages: [], vehicle_events: [], search_episodes: [], search_runs: [], problem_sources: [], sources: [], fleet_events: [], knowledge_items: [], limitations: ['No direct relation.'] });
    }
    return json({ items: [], total: 0, limit: 25, offset: 0 });
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/admin.html#knowledge/overview`, { waitUntil: 'networkidle' });

  const navigation = (await page.locator('[data-admin-section]').allTextContents())
    .map((value) => value.replace(/\s+/g, ' ').trim());
  assert.deepEqual(navigation, ['◎ Users', '▦ Knowledge Base']);
  assert.equal(await page.locator('#inspectorStats .inspector-stat-card').count(), 11);
  assert.equal(await page.locator('.admin-readonly-badge').innerText(), 'READ ONLY');

  await page.locator('[data-inspector-tab="conversations"]').click();
  assert(!requested.includes('/admin/knowledge/conversations/1/messages'));
  await page.locator('[data-inspector-kind="conversation"] > summary').click();
  await page.locator('.inspector-message').first().waitFor();
  assert(requested.includes('/admin/knowledge/conversations/1/messages'));

  await page.locator('[data-inspector-tab="search"]').click();
  await page.locator('[data-inspector-kind="episode"] > summary').click();
  await page.locator('.inspector-run').waitFor();
  assert(requested.includes('/admin/knowledge/search-episodes/4/runs'));

  await page.locator('[data-inspector-tab="problems"]').click();
  await page.locator('[data-inspector-kind="problem"] > summary').click();
  await page.locator('[data-load-trace]').click();
  await page.waitForFunction(() => document.querySelector('[data-problem-trace="7"]')?.dataset.loaded === 'true');
  assert(requested.includes('/admin/knowledge/problems/7/trace'));

  assert.deepEqual(mutations, []);
  assert.deepEqual(errors, []);
  console.log('Admin Data Inspector browser regression passed.');
})().finally(async () => {
  if (browser) await browser.close();
  server.kill();
});
