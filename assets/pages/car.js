// Real My Car page; persistence belongs to the existing authenticated backend.
window.PulsCar = (() => {
  const words = {
    myCar:['My Car','Мой автомобиль'], memory:['Your vehicle’s technical logbook','Техническая жизнь вашего автомобиля'], trash:['Deleted vehicles','Удалённые автомобили'],
    noCars:["You don't have any vehicles yet.",'У вас пока нет автомобилей.'], emptyHelp:['Add your vehicle so PULS can use its technical specifications, maintenance history and diagnostic context.','Добавьте автомобиль, чтобы PULS мог учитывать его характеристики, обслуживание и контекст диагностики.'],
    add:['+ Add vehicle','+ Добавить автомобиль'], actions:['⚙ Actions','⚙ Действия'], edit:['Edit vehicle','Редактировать автомобиль'], refreshVin:['Refresh VIN data','Обновить данные VIN'], correctSpecs:['Refresh / correct specifications','Обновить / исправить характеристики'], photo:['Change photo','Изменить фото'], primaryUnavailable:['Make primary — unavailable','Сделать основным — недоступно'], moveTrash:['Move to Trash','Переместить в корзину'],
    overview:['Overview','Обзор'], data:['Data','Данные'], history:['History','История'], problems:['Active Problems','Активные проблемы'], logbook:['Vehicle Log','Бортовой журнал'], addEntry:['+ Add entry','+ Добавить запись'], all:['All','Все'], maintenance:['Maintenance','Обслуживание'], repairs:['Repairs','Ремонт'],
    vinMethod:['VIN / chassis · Recommended','VIN / номер кузова · Рекомендуется'], manualMethod:['Manual entry','Вручную'], generation:['Generation / chassis','Поколение / кузов'], cancel:['Cancel','Отмена'], close:['Close','Закрыть'], specifications:['Technical specifications (optional)','Технические характеристики (необязательно)'], fillMissing:['Find missing specifications','Найти недостающие характеристики'], preserveManual:['Existing values are kept. Review the draft and save explicitly.','Введённые значения сохраняются. Проверьте черновик и нажмите «Сохранить».'],
    saveError:['Could not save. Your draft is still here; please retry.','Не удалось сохранить. Черновик остаётся на экране; попробуйте снова.'], loading:['Loading…','Загрузка…'], loadError:['Could not load this data.','Не удалось загрузить данные.'], retry:['Retry','Повторить'], noProblems:['No active problems recorded for this vehicle.','Для этого автомобиля нет активных проблем.'], noEvents:['No technical entries recorded for this vehicle.','Для этого автомобиля пока нет технических записей.'], unavailable:['Not recorded','Нет данных'], mileage:['Mileage','Пробег'],
    mainSpecs:['Main specifications','Основные характеристики'], engineFluids:['Engine and fluids','Двигатель и жидкости'], consumables:['Filters and consumables','Фильтры и расходники'], wheels:['Wheels and pressure','Колёса и давление'], fuelCapacities:['Fuel and capacities','Топливо и объёмы'], electrical:['Electrical','Электрика'], dimensions:['Dimensions and weight','Размеры и масса'], service:['Service specifications / torque','Сервисные данные / моменты затяжки'], environment:['Environmental parameters','Экологические параметры'], recommended:['Recommended','Рекомендовано'], actual:['Used on this vehicle','Используется на автомобиле'],
    continue:['Continue discussion in PULS','Продолжить обсуждение в PULS'], sources:['Sources used','Использованные материалы'], symptoms:['Symptoms','Симптомы'], conditions:['Conditions','Условия'], confirmed_facts:['Confirmed facts','Подтверждённые факты'], checks_summary:['Already checked','Что проверено'], hypotheses:['Hypotheses','Гипотезы'], actions_summary:['Actions taken','Выполненные действия'], current_conclusion:['Current conclusion','Текущий вывод'], next_step:['Next step','Следующий шаг'], confirmation:['Confirmed result','Подтверждённый результат'], started:['Started','Начало'],
    OPEN:['Open','Открыта'], IN_PROGRESS:['Diagnosis in progress','Диагностика в процессе'], SOLVED:['Solved','Решена'], CLOSED:['Closed','Закрыта'], ARCHIVED:['Archived','В архиве'],
    entryBoundary:['Manual log entries are not available yet. Existing technical records remain visible here. Nothing has been saved.','Ручное добавление записей пока недоступно. Существующая техническая история доступна в журнале. Ничего не сохранено.'],
    deleteTitle:['Delete vehicle?','Удалить автомобиль?'], deleteHelp:['The vehicle will be moved to Trash. Its technical history and photo will be retained; it can be restored during the recovery period shown in Trash.','Автомобиль будет перемещён в корзину. Техническая история и фото сохранятся. Восстановление доступно в течение срока, указанного в корзине.'], restore:['Restore','Восстановить'], restoreUntil:['Restore until','Восстановить до'], expired:['Recovery period has expired','Срок восстановления истёк'], noTrash:['No deleted vehicles.','Нет удалённых автомобилей.'],
    vinFailed:['Could not automatically identify the vehicle. Please complete the main vehicle information manually.','Не удалось автоматически определить автомобиль. Заполните основные данные вручную.'], signIn:['Sign in to load your vehicles.','Войдите, чтобы загрузить свои автомобили.']
  };
  const text = key => words[key]?.[getLanguage()==='ru'?1:0] || key;
  const el = id => document.getElementById(id), esc = v => escapeHtml(v ?? '');
  let initialized=false, editing=false, tab='overview', filter='all', version=0, selectedProblem=null, busy=false, authOwner='';
  let state={id:'',owner:'',loading:false,detail:null,problems:[],events:[],errors:{}};
  const date = v => v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleDateString(currentLocale()) : text('unavailable');
  function valueText(v) {
    if(v==null || v==='') return text('unavailable');
    if(Array.isArray(v)) return v.map(valueText).join('\n');
    if(typeof v==='object') return Object.entries(v).map(([k,x])=>`${k.replaceAll('_',' ')}: ${valueText(x)}`).join('\n');
    return String(v);
  }
  function specValues(raw={}) {
    if(Array.isArray(raw.items))return Object.fromEntries(raw.items.filter(row=>row.parameter_key).map(row=>[row.parameter_key,row.actual_value ?? row.recommended_value ?? '']));
    return {...raw,...(raw.specs||{})};
  }
  async function api(path,options={}) {
    const headers=await backendAuthHeaders();
    if(!headers.Authorization) throw Error('Authentication required');
    const response=await fetch(`${API_BASE_URL}${path}`,{...options,headers});
    if(!response.ok) throw Error(`HTTP ${response.status}`);
    return response.json();
  }
  function translate(){document.querySelectorAll('[data-v2]').forEach(n=>n.textContent=text(n.dataset.v2));}
  const notice = key => `<p class="vehicle-empty-note">${esc(text(key))}</p>`;
  const errorBlock = () => `${notice('loadError')}<button type="button" class="btn" data-car-action="retry">${esc(text('retry'))}</button>`;
  function setTab(next){
    tab=['overview','data','history'].includes(next)?next:'overview';
    document.querySelectorAll('[data-car-tab]').forEach(b=>{const selected=b.dataset.carTab===tab;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;el(`car-${b.dataset.carTab}`).hidden=!selected;});
  }
  function render(){
    if(!initialized)return;
    translate();
    const vehicles=loadVehicleStore().vehicles.filter(v=>isBackendVehicleId(v.id)&&v.lifecycle_status!=='TRASHED');
    const vehicle=vehicles.find(v=>v.id===loadVehicleProfile().id)||vehicles[0];
    el('carV2Status').innerHTML=vehicleSyncError?errorBlock():!isSignedIn()?notice('signIn'):'';
    el('vehicleSwitcher').innerHTML=vehicles.map(v=>`<button type="button" class="vehicle-chip ${v.id===vehicle?.id?'active':''}" data-car-vehicle="${esc(v.id)}">${v.photoUrl?`<img src="${esc(v.photoUrl)}" alt="" loading="lazy">`:''}<span>${esc(getVehicleLabel(v))}<small>${esc([v.generation,v.year,v.engine,v.mileage?`${v.mileage} km`:''].filter(Boolean).join(' · '))}</small></span></button>`).join('')+(vehicles.length?`<button type="button" class="btn" data-car-action="add">${esc(text('add'))}</button>`:'');
    el('carEmpty').hidden=!!vehicles.length||editing||!!vehicleSyncError;
    el('carVehicle').hidden=!vehicle||editing;el('carEditor').hidden=!editing;
    if(!vehicle||editing)return;
    el('vehicleTitle').textContent=getVehicleLabel(vehicle);
    el('vehicleIdentity').textContent=[vehicle.generation,vehicle.year,vehicle.engine,vehicle.fuel,vehicle.transmission,vehicle.drive].filter(Boolean).join(' · ');
    el('vehicleVin').textContent=vehicle.vin?`VIN / chassis: ${vehicle.vin}`:'';
    el('vehicleMileage').textContent=vehicle.mileage?`${text('mileage')}: ${vehicle.mileage} km`:'';
    setCarPhotoPreview(vehicle.photoUrl);setTab(tab);
    if(state.id!==vehicle.id||state.owner!==window.pulsCurrentUser?.id){void load(vehicle.id);return;}
    renderSections(vehicle);
  }
  async function load(id){
    const request=++version,owner=window.pulsCurrentUser?.id;
    state={id,owner,loading:true,detail:null,problems:[],events:[],errors:{}};selectedProblem=null;
    renderSections(loadVehicleProfile());
    const results=await Promise.allSettled([api(`/api/vehicles/${encodeURIComponent(id)}`),api(`/api/vehicles/${encodeURIComponent(id)}/problems?status=all`),api(`/api/vehicles/${encodeURIComponent(id)}/timeline`)]);
    if(request!==version||owner!==window.pulsCurrentUser?.id||loadVehicleProfile().id!==id)return;
    ['detail','problems','events'].forEach((key,i)=>{
      const r=results[i];if(r.status==='rejected')state.errors[key]=true;
      else if(key==='detail'){if(r.value.vehicle?.id!==id)state.errors[key]=true;else state.detail=r.value;}
      else state[key]=(r.value[key]||[]).filter(row=>row.vehicle_id===id);
    });
    if(state.detail){
      const detail=state.detail;
      saveVehicleProfile(vehicleFromApi({...detail.vehicle,...specValues(detail.specs||{}),id:detail.vehicle.id}));
    }
    state.loading=false;render();
  }
  function problemCard(p){return `<button type="button" class="problem-card" data-car-problem="${esc(p.id)}"><strong>${esc(p.title||text('problems'))}</strong><span>${esc(text(p.status))}</span><small>${esc(text('started'))}: ${esc(date(p.first_seen_at||p.created_at))}</small></button>`;}
  function timeline(){
    // Structured technical records only. Conversation messages never enter this log.
    const rows=state.events.map(e=>({...e,time:e.occurred_at||e.created_at,category:/maintenance|service/i.test(e.event_type)?'maintenance':/repair|replacement/i.test(e.event_type)?'repairs':/problem|diagnos|result/i.test(e.event_type)?'problems':'all'}));
    for(const p of state.problems)rows.push({id:p.id,problem_id:p.id,title:p.title,description:[text(p.status),p.current_conclusion,Object.keys(p.confirmation||{}).length?valueText(p.confirmation):''].filter(Boolean).join('\n'),time:p.last_seen_at||p.updated_at||p.first_seen_at||p.created_at,mileage:p.mileage,category:'problems'});
    return rows.sort((a,b)=>(Date.parse(b.time)||0)-(Date.parse(a.time)||0));
  }
  function logMarkup(rows){return rows.length?`<ol class="vehicle-log">${rows.map(e=>`<li><div class="log-meta">${esc(date(e.time))}${e.mileage!=null?` · ${esc(e.mileage)} km`:''}</div>${e.problem_id?`<button class="log-problem" type="button" data-car-problem="${esc(e.problem_id)}">${esc(e.title||e.event_type)}</button>`:`<strong>${esc(e.title||e.event_type)}</strong>`}${e.description?`<p>${esc(e.description)}</p>`:''}${Object.keys(e.event_data||{}).length?`<p>${esc(valueText(e.event_data))}</p>`:''}</li>`).join('')}</ol>`:notice('noEvents');}
  function renderSections(v){
    if(state.loading){['vehicleProblems','vehicleRecentLog','vehicleHistory','vehicleData'].forEach(id=>el(id).innerHTML=notice('loading'));return;}
    const active=state.problems.filter(p=>['OPEN','IN_PROGRESS'].includes(p.status));
    el('vehicleProblems').innerHTML=state.errors.problems?errorBlock():active.map(problemCard).join('')||notice('noProblems');
    const rows=timeline(), warning=state.errors.events||state.errors.problems?errorBlock():'';
    el('vehicleRecentLog').innerHTML=warning+logMarkup(rows.slice(0,5));
    el('vehicleHistory').innerHTML=warning+logMarkup(rows.filter(e=>filter==='all'||e.category===filter));
    document.querySelectorAll('[data-car-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.carFilter===filter)));
    if(state.errors.detail){el('vehicleData').innerHTML=errorBlock();return;}
    const s=specValues(state.detail?.specs||{});
    const groups=[['mainSpecs',[['Make',v.brand],['Model',v.model],[text('generation'),v.generation],['Year',v.year],['VIN / chassis',v.vin],[text('mileage'),v.mileage?`${v.mileage} km`:'']]],['engineFluids',[['Engine',v.engine],['Transmission',v.transmission],['Drivetrain',v.drive],['Displacement',s.displacement],['Power',s.power],['Torque',s.torque],['Engine type',s.engine_type],['Cylinders',s.cylinders]]],['consumables',[]],['wheels',[]],['fuelCapacities',[['Fuel',v.fuel],['Tank',s.tank]]],['electrical',[]],['dimensions',[]],['service',[]],['environment',[['Emissions',s.emissions]]]];
    el('vehicleData').innerHTML=groups.map(([key,entries],i)=>`<details class="vehicle-data-group" ${i===0?'open':''}><summary>${esc(text(key))}</summary>${entries.some(([,x])=>x!=null&&x!=='')?`<dl class="vehicle-data-list">${entries.filter(([,x])=>x!=null&&x!=='').map(([k,x])=>`<dt>${esc(k)}</dt><dd>${esc(valueText(x))}</dd>`).join('')}</dl>`:notice('unavailable')}${key==='consumables'?`<div class="vehicle-values"><div><h4>${esc(text('recommended'))}</h4>${notice('unavailable')}</div><div><h4>${esc(text('actual'))}</h4>${notice('unavailable')}</div></div>`:''}</details>`).join('');
  }
  function modal(content){el('vehicleDialogContent').innerHTML=content;if(!el('vehicleDialog').open)el('vehicleDialog').showModal();}
  function close(){el('vehicleDialog').close();selectedProblem=null;}
  function sourceMarkup(relations){
    const seen=new Set(),sources=[];
    for(const relation of Array.isArray(relations)?relations:[]){
      const source=relation?.sources&&typeof relation.sources==='object'?relation.sources:relation;
      const url=String(source?.url||'').trim();if(!url||seen.has(url))continue;seen.add(url);
      sources.push({url,title:String(source?.title||url),description:String(source?.description||relation?.extracted_evidence||source?.domain||'')});
    }
    if(!sources.length)return '';
    return `<section class="problem-detail"><h3>${esc(text('sources'))}</h3><div class="request-links">${sources.map(item=>`<a class="request-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(item.title)}</strong>${item.description?`<small>${esc(item.description)}</small>`:''}</a>`).join('')}</div></section>`;
  }
  async function problem(id){
    const vehicleId=loadVehicleProfile().id,owner=window.pulsCurrentUser?.id,request=version;
    selectedProblem=null;modal(notice('loading'));
    try{const data=await api(`/api/problems/${encodeURIComponent(id)}`);
      if(!el('vehicleDialog').open||request!==version||owner!==window.pulsCurrentUser?.id||vehicleId!==loadVehicleProfile().id)return;
      if(data.problem?.vehicle_id!==vehicleId)throw Error('Vehicle mismatch');
      const p=selectedProblem=data.problem;
      modal(`<h2>${esc(p.title)}</h2><p>${esc(text(p.status))} · ${esc(date(p.first_seen_at||p.created_at))}${p.mileage!=null?` · ${esc(p.mileage)} km`:''}</p>${['symptoms','conditions','confirmed_facts','checks_summary','hypotheses','actions_summary','current_conclusion','next_step','confirmation'].filter(k=>p[k]&&(typeof p[k]!=='object'||Object.keys(p[k]).length)).map(k=>`<section class="problem-detail"><h3>${esc(text(k))}</h3><p>${esc(valueText(p[k]))}</p></section>`).join('')}${sourceMarkup(data.sources)}<button type="button" class="btn blue" data-car-action="continue">${esc(text('continue'))}</button>`);
    }catch{if(request===version&&el('vehicleDialog').open)modal(notice('loadError'));}
  }
  function beginEdit(add=false){
    if(!requireSignedInForEdit())return;
    if(!add&&(state.loading||state.errors.detail||!state.detail)){toast(text('loadError'));return;}
    const profile=add?normalizeVehicleProfile({id:createVehicleId()}):vehicleFromApi({...state.detail.vehicle,...specValues(state.detail.specs||{}),id:state.detail.vehicle.id});
    editing=true;++vehicleLookupRequestId;fillVehicleForm(profile);
    el('carFormStatus').textContent='';el('carFormStatus').classList.remove('error');el('carLookupStatus').textContent='';
    render();el('carEditorTitle').textContent=text(add?'add':'edit');el('carBrandInput').focus();
  }
  async function trashList(){
    if(!requireSignedInForEdit())return;const owner=window.pulsCurrentUser?.id;modal(notice('loading'));
    try{const data=await api('/api/vehicles?include_trashed=true');if(owner!==window.pulsCurrentUser?.id||!el('vehicleDialog').open)return;
      const rows=data.vehicles.filter(v=>v.lifecycle_status==='TRASHED');
      modal(`<h2>${esc(text('trash'))}</h2>`+(rows.length?rows.map(v=>{const ok=Number.isFinite(Date.parse(v.restore_until))&&Date.parse(v.restore_until)>Date.now();return `<article class="trash-row"><strong>${esc([v.brand,v.model,v.year].filter(Boolean).join(' '))}</strong><p>${esc(text('restoreUntil'))}: ${esc(date(v.restore_until))}</p><button class="btn" type="button" data-car-restore="${esc(v.id)}" ${ok?'':'disabled'}>${esc(text(ok?'restore':'expired'))}</button></article>`;}).join(''):notice('noTrash')));
    }catch{if(owner===window.pulsCurrentUser?.id&&el('vehicleDialog').open)modal(notice('loadError'));}
  }
  function closeNavigation(){document.body.classList.remove('navigation-open');el('mobileNavToggle')?.setAttribute('aria-expanded','false');if(el('mobileNavBackdrop'))el('mobileNavBackdrop').hidden=true;}
  function invalidate(){++version;state.id='';}
  function authChanged(){const next=window.pulsCurrentUser?.id||'';if(next===authOwner)return;authOwner=next;++version;state={id:'',owner:'',loading:false,detail:null,problems:[],events:[],errors:{}};editing=false;selectedProblem=null;serverVehicleStore=null;++vehicleLookupRequestId;if(el('vehicleDialog')?.open)close();render();}
  function init(){
    if(initialized)return;initialized=true;authOwner=window.pulsCurrentUser?.id||'';
    i18n.en['car.formMileage']='Mileage (km)';i18n.ru['car.formMileage']='Пробег (км)';
    for(const lang of ['en','ru'])for(const key of ['car.lookupNotFound','car.lookupError','car.lookupInvalid','car.lookupNeedVin'])i18n[lang][key]=words.vinFailed[lang==='ru'?1:0];
    el('carCancelEdit').addEventListener('click',()=>{if(busy)return;editing=false;++vehicleLookupRequestId;fillVehicleForm(loadVehicleProfile());render();});
    el('carTrash').addEventListener('click',trashList);
    el('mobileNavToggle').addEventListener('click',()=>{const opened=document.body.classList.toggle('navigation-open');el('mobileNavToggle').setAttribute('aria-expanded',String(opened));el('mobileNavBackdrop').hidden=!opened;});
    el('mobileNavBackdrop').addEventListener('click',closeNavigation);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeNavigation();if(event.target.matches('[data-car-tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const tabs=['overview','data','history'],index=event.key==='Home'?0:event.key==='End'?2:(tabs.indexOf(tab)+(event.key==='ArrowRight'?1:2))%3;setTab(tabs[index]);el(`tab-${tabs[index]}`).focus();}});
    document.addEventListener('click',async event=>{
      const b=event.target.closest('[data-car-action],[data-car-tab],[data-car-filter],[data-car-problem],[data-car-vehicle],[data-car-restore]');if(!b||b.disabled||busy)return;const d=b.dataset;
      if(d.carTab)return setTab(d.carTab);
      if(d.carFilter){filter=d.carFilter;renderSections(loadVehicleProfile());return;}
      if(d.carProblem)return problem(d.carProblem);
      if(d.carVehicle){editing=false;++vehicleLookupRequestId;fillVehicleForm(setActiveVehicleProfile(d.carVehicle));tab='overview';filter='all';render();return;}
      if(d.carRestore){b.disabled=true;try{await api(`/api/vehicles/${encodeURIComponent(d.carRestore)}/restore`,{method:'POST'});close();await syncVehicleStoreFromBackend();invalidate();render();}catch{b.disabled=false;toast(text('loadError'));}return;}
      document.querySelectorAll('.vehicle-actions[open]').forEach(n=>n.open=false);
      switch(d.carAction){
        case 'add':beginEdit(true);break;case 'edit':beginEdit();break;
        case 'vin':beginEdit();el('carVinInput').focus();break;
        case 'specs':beginEdit();document.querySelector('.vehicle-spec-editor').open=true;break;
        case 'photo':el('carPhotoInput').click();break;
        case 'method-vin':el('carVinInput').focus();break;case 'method-manual':el('carBrandInput').focus();break;
        case 'entry':modal(`<h2>${esc(text('addEntry'))}</h2>${notice('entryBoundary')}`);break;
        case 'retry':await syncVehicleStoreFromBackend();invalidate();render();break;
        case 'close':close();break;
        case 'continue':if(selectedProblem){window.PulsChat.continueProblem(loadVehicleProfile(),selectedProblem);close();showView('assistant');el('promptInput').focus();}break;
        case 'trash':modal(`<h2>${esc(text('deleteTitle'))}</h2>${notice('deleteHelp')}<div class="profile-actions"><button type="button" class="btn" data-car-action="close">${esc(text('cancel'))}</button><button type="button" class="btn danger-btn" data-car-action="confirm-trash">${esc(text('moveTrash'))}</button></div>`);break;
        case 'confirm-trash':b.disabled=true;try{await deleteVehicleFromBackend(loadVehicleProfile());close();await syncVehicleStoreFromBackend();invalidate();render();}catch{b.disabled=false;toast(text('loadError'));}break;
      }
    });render();
  }
  return {init,render,translate,text,closeNavigation,authChanged,invalidate,isEditing(){return editing;},setBusy(value){busy=value;},photoReady(){return !busy&&!state.loading&&!state.errors.detail&&state.detail?.vehicle?.id===loadVehicleProfile().id;},saved(){editing=false;invalidate();render();}};
})();
