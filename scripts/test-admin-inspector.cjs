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
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, locale: 'ru-RU' });
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
          users: 3, vehicles: 4, conversations: 1, messages: 2, problems: 1, vehicle_events: 1,
          search_episodes: 1, search_runs: 1, sources: 1, problem_sources: 1,
          knowledge_items: 1, knowledge_sources: 1, fleet_events: 1,
        },
        metrics: {
          users: 3, vehicles: 4, conversations: 1, messages: 2, active_problems: 1,
          vehicle_events: 1, search_episodes: 1, search_runs: 1, sources: 1, knowledge_items: 1,
        },
        distributions: {
          data_volume: { messages: 2, problems: 1, vehicle_events: 1, search_runs: 1, sources: 1, knowledge_items: 1 },
          problem_status: { OPEN: 1, IN_PROGRESS: 0, AWAITING_CONFIRMATION: 0, SOLVED: 0, CLOSED: 0 },
          vehicle_event_type: { SYMPTOM: 1, DTC: 0, CHECK: 0, REPAIR: 0, SERVICE: 0, REPLACEMENT: 0, RESULT: 0, MILEAGE: 0, NOTE: 0 },
          source_type: { FORUM: 1 },
        },
        recent: { conversations: [], problems: [], search_episodes: [], knowledge_items: [] },
        errors: {},
      });
    }
    if (pathname === '/admin/knowledge/conversations') {
      return json({ items: [{
        id: '1', context: { initial_text: 'Noise diagnosis' }, status: 'ACTIVE', message_count: 2,
        user: { email: 'owner@test.local' }, vehicle: { make: 'Nissan', model: 'X-Trail' },
      }], total: 1, limit: 25, offset: 0, warnings: [] });
    }
    if (pathname === '/admin/knowledge/vehicles') {
      return json({ items: [{
        id: 'v1', user_id: 'u2', make: 'Peugeot', model: '307', year: 2006,
        engine_code: 'TU5JP4', transmission: 'AL4', fuel_type: 'Petrol', drivetrain: 'FWD',
        lifecycle_status: 'ACTIVE', spec_count: 1, problem_count: 2, event_count: 3,
        user: { email: 'owner@test.local' },
      }], total: 1, limit: 25, offset: 0, warnings: [] });
    }
    if (pathname === '/admin/knowledge/vehicles/v1/specs') {
      return json({ items: [{
        id: 'vs1', category: 'transmission', parameter_key: 'fluid',
        parameter_name: 'Transmission fluid', actual_value: 'LT 71141', source_type: 'USER',
      }], total: 1, limit: 100, offset: 0, warnings: [] });
    }
    if (pathname === '/admin/knowledge/conversations/1/messages') {
      return json({ items: [
        { id: 1, role: 'USER', content: 'Cold start noise' },
        { id: 2, role: 'ASSISTANT', content: 'Check timing chain tension.' },
      ], total: 2, limit: 100, offset: 0 });
    }
    if (pathname === '/admin/knowledge/search-episodes') {
      return json({ items: [{ id: 4, status: 'COMPLETED', search_context: { reason: 'insufficient internal evidence', vehicle_id: 'v1' }, current_stage: 1 }], total: 1, limit: 25, offset: 0, warnings: [] });
    }
    if (pathname === '/admin/knowledge/search-episodes/4/runs') {
      return json({ items: [{ id: 5, stage_number: 1, status: 'COMPLETED', run_type: 'web', sufficient_evidence: true, query: { text: 'timing chain noise' }, input_context: { vehicle: 'Nissan' }, result_summary: 'Chain tensioner reports found', sources_found: 3, relevant_sources: 2 }], total: 1, limit: 50, offset: 0 });
    }
    if (pathname === '/admin/knowledge/problems') {
      return json({ items: [{ id: 7, title: 'Cold start noise', problem_class: 'OTHER', status: 'OPEN' }], total: 1, limit: 25, offset: 0, warnings: [] });
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
  assert.deepEqual(navigation, ['◎ Users', '▦ Knowledge Base', '⇄ Live Request Flow']);
  assert.equal(await page.locator('#inspectorStats .inspector-stat-card').count(), 10);
  assert.equal(await page.locator('#adminKnowledgeSection .admin-readonly-badge').innerText(), 'READ ONLY');
  assert.equal(await page.locator('#inspectorDataFlow .data-flow-node').count(), 11);
  assert.equal(await page.locator('#inspectorSourceTypes .distribution-row').count(), 1);
  assert((await page.locator('#inspectorProblemStatus').innerText()).includes('ОТКРЫТА'));
  if (process.env.ADMIN_SCREENSHOT) {
    await page.screenshot({ path: process.env.ADMIN_SCREENSHOT, fullPage: true });
  }

  await page.locator('#adminSidebarToggle').click();
  assert(await page.locator('.admin-shell').evaluate((node) => node.classList.contains('is-sidebar-collapsed')));

  await page.locator('#inspectorStats .inspector-stat-card').filter({ hasText: 'Vehicles' }).click();
  await page.locator('[data-inspector-kind="vehicle"] > summary').waitFor();
  assert.equal(await page.locator('[data-inspector-tab="vehicles"]').getAttribute('class'), 'inspector-tab is-active');
  assert(!requested.includes('/admin/knowledge/vehicles/v1/specs'));
  await page.locator('[data-inspector-kind="vehicle"] > summary').click();
  await page.locator('[data-inspector-kind="vehicle-spec"]').waitFor();
  assert(requested.includes('/admin/knowledge/vehicles/v1/specs'));

  await page.locator('[data-inspector-tab="conversations"]').click();
  assert(!requested.includes('/admin/knowledge/conversations/1/messages'));
  await page.locator('[data-inspector-kind="conversation"] > summary').click();
  await page.locator('.inspector-message').first().waitFor();
  assert(requested.includes('/admin/knowledge/conversations/1/messages'));

  await page.locator('[data-inspector-tab="search"]').click();
  await page.locator('[data-inspector-kind="episode"] > summary').click();
  await page.locator('.inspector-run').waitFor();
  assert(requested.includes('/admin/knowledge/search-episodes/4/runs'));
  assert(!(await page.locator('.inspector-run').innerText()).includes('[object Object]'));

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
