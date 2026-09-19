/* Focused Knowledge Library browser test. Supabase, API and provider traffic are fully mocked. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = 4193;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'pipe', windowsHide: true });
let browser;
const materials = [
  { id:'general-model', title:'Peugeot 307 overview', knowledge_type:'ARTICLE', summary:'All Peugeot 307 variants', validation_status:'VERIFIED', provenance_type:'EXTERNAL_WEB', vehicle_configuration_id:'cfg-general', applicability:{id:'cfg-general',make:'Peugeot',model:'307'}, metadata:{lifecycle_status:'ACTIVE'}, knowledge_sources:[] },
  { id:'specific-existing', title:'TU5JP4 2004 specification', knowledge_type:'SPECIFICATION', summary:'Specific engine data', validation_status:'VERIFIED', provenance_type:'MANUFACTURER', vehicle_configuration_id:'cfg-specific', applicability:{id:'cfg-specific',make:'Peugeot',model:'307',year_from:2004,year_to:2004,engine_code:'TU5JP4'}, metadata:{lifecycle_status:'ACTIVE'}, knowledge_sources:[] },
];
let reviewed = false;
const originalCase = { id:'fleet-1', symptoms:['No drive after warm-up'], cause:'Hydraulic pressure loss', action:'Valve body repair', result:'HELPED', origin_event_id:'event-1' };

(async () => {
  for (let i=0;i<40;i+=1) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise((r)=>setTimeout(r,100)); }
  browser = await chromium.launch({ headless:true, ...(process.env.CHROME_PATH ? { executablePath:process.env.CHROME_PATH } : {}) });
  const context = await browser.newContext({ viewport:{width:1440,height:1000} });
  const calls=[];
  const postedBodies=[];
  await context.route('**/*', async (route) => {
    const request=route.request(); const url=new URL(request.url()); const pathname=url.pathname;
    if (url.hostname==='cdn.jsdelivr.net') return route.fulfill({contentType:'text/javascript',body:`window.supabase={createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:'fixture-token',user:{email:'admin@puls.test'}}},error:null})}}}};`});
    if (url.hostname!=='127.0.0.1'||!pathname.startsWith('/admin/')) return route.continue();
    calls.push(`${request.method()} ${pathname}${url.search}`); assert.equal(request.headers().authorization,'Bearer fixture-token');
    const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
    if (pathname==='/admin/users') return json({users:[]});
    if (pathname==='/admin/knowledge/library/catalog') return json({items:[{make:'Peugeot',models:['206','307','308']},{make:'Porsche',models:['911']}],total:4});
    if (pathname==='/admin/knowledge/library/items'&&request.method()==='GET') {
      let items=materials.filter((item)=>item.metadata?.lifecycle_status!=='ARCHIVED');
      if (url.searchParams.get('scope')==='general') items=items.filter((item)=>!item.vehicle_configuration_id);
      else if (url.searchParams.get('make')) items=items.filter((item)=>item.applicability?.make===url.searchParams.get('make')&&item.applicability?.model===url.searchParams.get('model'));
      const category=url.searchParams.get('category');
      const groups={manuals:['MANUAL','MANUFACTURER_DOCUMENT','TECHNICAL_BULLETIN'],specifications:['SPECIFICATION'],procedures:['PROCEDURE','DIAGNOSTIC_REFERENCE'],videos:['VIDEO'],forums:['FORUM'],'successful-cases':['SUCCESSFUL_CASE']};
      if (groups[category]) items=items.filter((item)=>groups[category].includes(item.knowledge_type));
      const counts={ALL:items.length}; items.forEach((item)=>{counts[item.knowledge_type]=(counts[item.knowledge_type]||0)+1;});
      return json({items,total:items.length,limit:25,offset:0,counts});
    }
    if (pathname==='/admin/knowledge/library/items'&&request.method()==='POST') {
      const body=request.postDataJSON(); postedBodies.push(body); const vehicle=body.applicability?.make;
      const item={id:`created-${materials.length}`,title:body.title,knowledge_type:body.knowledge_type,summary:body.description,validation_status:body.validation_status,provenance_type:body.source_type==='MANUAL'?'MANUAL':'EXTERNAL_WEB',vehicle_configuration_id:vehicle?'cfg-new':null,applicability:vehicle?{id:'cfg-new',...body.applicability}:null,metadata:{lifecycle_status:'ACTIVE',notes:body.notes},knowledge_sources:body.url?[{source:{id:'source-new',title:body.title,url:body.url,source_type:body.source_type}}]:[]};
      materials.push(item); return json(item);
    }
    const itemMatch=pathname.match(/^\/admin\/knowledge\/library\/items\/([^/]+)$/);
    if (itemMatch&&request.method()==='PATCH') { const item=materials.find((value)=>value.id===itemMatch[1]); Object.assign(item,request.postDataJSON()); return json(item); }
    const archiveMatch=pathname.match(/^\/admin\/knowledge\/library\/items\/([^/]+)\/archive$/);
    if (archiveMatch) { const item=materials.find((value)=>value.id===archiveMatch[1]); item.metadata.lifecycle_status='ARCHIVED'; return json(item); }
    if (pathname==='/admin/knowledge/library/problems') return json({items:[{id:'problem-1',title:'Transmission slips hot',status:'OPEN',symptoms:['No drive hot'],confirmed_facts:['RPM rises'],current_conclusion:null,vehicle:{make:'Peugeot',model:'307',year:2004,engine_code:'TU5JP4',transmission:'Automatic'}}],total:1,limit:25,offset:0});
    if (pathname==='/admin/knowledge/library/review-queue') {
      if (reviewed) return json({items:[{candidate_type:'KNOWLEDGE',candidate:{id:'reviewed-1',title:'No drive after warm-up',validation_status:'VERIFIED',metadata:{original_case:originalCase,mechanic_review:{decision:'VERIFIED',technical_comment:'Confirmed'}}}}],total:1,limit:25,offset:0});
      return json({items:[{candidate_type:'SUCCESSFUL_CASE',candidate:originalCase}],total:1,limit:25,offset:0});
    }
    if (pathname==='/admin/knowledge/library/reviews'&&request.method()==='POST') { reviewed=true; return json({id:'reviewed-1'}); }
    return json({});
  });
  const page=await context.newPage();
  await page.goto(`${base}/admin.html#knowledge/library`);
  await page.locator('#inspectorLibrary').waitFor();

  // F. Search and alphabet navigation both resolve Peugeot 307.
  await page.locator('#libraryCatalogSearch').fill('Peugeot 307');
  await page.locator('#librarySearchButton').click();
  await page.locator('[data-knowledge-model="307"]').waitFor();
  assert(calls.some((call)=>call.includes('/catalog?q=Peugeot+307')));
  await page.locator('[data-knowledge-letter="P"]').click();
  assert(calls.some((call)=>call.includes('/catalog?letter=P')));
  await page.locator('[data-knowledge-model="307"]').click();
  await page.getByText('Peugeot 307 overview').waitFor();
  assert.match(await page.locator('.knowledge-material-card').filter({hasText:'TU5JP4 2004 specification'}).textContent(),/2004–2004.*TU5JP4/);

  // A. Add a sourced manual.
  await page.locator('#knowledgeAddMaterial').click();
  await page.locator('#materialTitle').fill('Peugeot 307 workshop manual');
  await page.locator('#materialType').selectOption('MANUAL');
  await page.locator('#materialDescription').fill('Workshop procedures');
  await page.locator('#materialUrl').fill('https://manual.example.test/307');
  await page.locator('#materialSourceType').selectOption('MANUAL');
  await page.locator('#knowledgeMaterialForm').evaluate((form)=>form.requestSubmit());
  await page.getByRole('heading',{name:'Peugeot 307 workshop manual'}).waitFor();
  assert.match(await page.locator('.knowledge-material-card').filter({hasText:'Peugeot 307 workshop manual'}).textContent(),/MANUAL/);
  await page.locator('[data-knowledge-category="manuals"]').click();
  await page.getByRole('heading',{name:'Peugeot 307 workshop manual'}).waitFor();
  assert.equal(postedBodies[0].applicability.make,'Peugeot');
  assert.equal(postedBodies[0].applicability.model,'307');
  await page.locator('[data-knowledge-category="overview"]').click();

  // B. Specific applicability remains explicit.
  await page.locator('#knowledgeAddMaterial').click();
  await page.locator('[data-material-mode="note"]').click();
  await page.locator('#materialTitle').fill('2006 AL4 pressure specification');
  await page.locator('#materialType').selectOption('SPECIFICATION');
  await page.locator('#materialYearFrom').fill('2006');
  await page.locator('#materialYearTo').fill('2006');
  await page.locator('#materialEngine').fill('TU5JP4');
  await page.locator('#materialTransmission').fill('Automatic');
  await page.locator('#knowledgeMaterialForm').evaluate((form)=>form.requestSubmit());
  const specific=page.locator('.knowledge-material-card').filter({hasText:'2006 AL4 pressure specification'});
  await specific.waitFor(); assert.match(await specific.textContent(),/2006–2006.*TU5JP4.*Automatic/);

  // C. General knowledge is saved without vehicle applicability.
  await page.locator('#knowledgeGeneralScope').click();
  await page.locator('#knowledgeAddMaterial').click();
  await page.locator('[data-material-mode="note"]').click();
  await page.locator('#materialTitle').fill('Voltage drop fundamentals');
  await page.locator('#materialType').selectOption('GENERAL');
  await page.locator('#knowledgeMaterialForm').evaluate((form)=>form.requestSubmit());
  await page.getByText('Voltage drop fundamentals').waitFor();
  const generalPost=calls.filter((call)=>call==='POST /admin/knowledge/library/items').length;
  assert.equal(generalPost,3);
  assert.equal(postedBodies[2].applicability,null);

  // D/E. Successful Case candidate and mechanic review keep the original visible.
  await page.locator('[data-inspector-tab="review"]').click();
  await page.getByRole('heading',{name:'No drive after warm-up'}).waitFor();
  assert.match(await page.locator('.knowledge-review-card').textContent(),/Original Case.*Valve body repair/s);
  await page.locator('[data-review-candidate-id="fleet-1"]').click();
  await page.locator('#reviewComment').fill('Confirmed');
  await page.locator('#knowledgeReviewForm').evaluate((form)=>form.requestSubmit());
  await page.getByRole('heading',{name:'No drive after warm-up'}).waitFor();
  const reviewedCard=await page.locator('.knowledge-review-card').textContent();
  assert.match(reviewedCard,/Original Case.*Valve body repair/s);
  assert.match(reviewedCard,/Mechanic Review.*VERIFIED/s);

  assert.equal(calls.some((call)=>/\/(chat|search|parser)(?:\?|$|\/)/i.test(call)),false);
  console.log('Admin Knowledge Library mocked regression passed.');
})().finally(async()=>{if(browser)await browser.close();server.kill();}).catch((error)=>{console.error(error);process.exitCode=1;});
