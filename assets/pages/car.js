// Real My Car page; persistence belongs to the existing authenticated backend.
window.PulsCar = (() => {
  const words = {
    myCar:['My Car','Мой автомобиль'], memory:['Your vehicle’s technical logbook','Техническая жизнь вашего автомобиля'], trash:['Trash','Корзина'],
    noCars:["You don't have any vehicles yet.",'У вас пока нет автомобилей.'], emptyHelp:['Add your vehicle so PULS can use its technical specifications, maintenance history and diagnostic context.','Добавьте автомобиль, чтобы PULS мог учитывать его характеристики, обслуживание и контекст диагностики.'],
    add:['+ Add vehicle','+ Добавить автомобиль'], addPlain:['Add vehicle','Добавить автомобиль'], settings:['⚙ Settings','⚙ Настройки'], edit:['Edit vehicle','Редактировать автомобиль'], deleteVehicle:['Delete vehicle','Удалить автомобиль'], moveTrash:['Move to Trash','Переместить в корзину'],
    overview:['Overview','Обзор'], data:['Data','Данные'], history:['History','История'], problems:['Active Problems','Активные проблемы'], logbook:['Vehicle Log','Бортовой журнал'], addEntry:['+ Add entry','+ Добавить запись'], all:['All','Все'], maintenance:['Maintenance','Обслуживание'], repairs:['Repairs','Ремонт'], year:['Year','Год'], engine:['Engine','Двигатель'], fuel:['Fuel','Топливо'], drivetrain:['Drivetrain','Привод'],
    vinMethod:['VIN / chassis · Recommended','VIN / номер кузова · Рекомендуется'], manualMethod:['Manual entry','Вручную'], generation:['Generation / chassis','Поколение / кузов'], cancel:['Cancel','Отмена'], close:['Close','Закрыть'], specifications:['Technical specifications (optional)','Технические характеристики (необязательно)'], fillMissing:['Find missing specifications','Найти недостающие характеристики'], preserveManual:['Existing values are kept. Review the draft and save explicitly.','Введённые значения сохраняются. Проверьте черновик и нажмите «Сохранить».'],
    saveError:['Could not save. Your draft is still here; please retry.','Не удалось сохранить. Черновик остаётся на экране; попробуйте снова.'], loading:['Loading…','Загрузка…'], loadError:['Could not load this data.','Не удалось загрузить данные.'], retry:['Retry','Повторить'], noProblems:['No active problems recorded for this vehicle.','Для этого автомобиля нет активных проблем.'], noEvents:['No technical entries recorded for this vehicle.','Для этого автомобиля пока нет технических записей.'], unavailable:['Not recorded','Нет данных'], mileage:['Mileage','Пробег'],
    mainSpecs:['Main specifications','Основные характеристики'], engineFluids:['Engine and fluids','Двигатель и жидкости'], consumables:['Filters and consumables','Фильтры и расходники'], wheels:['Wheels and pressure','Колёса и давление'], fuelCapacities:['Fuel and capacities','Топливо и объёмы'], electrical:['Electrical','Электрика'], dimensions:['Dimensions and weight','Размеры и масса'], service:['Service specifications / torque','Сервисные данные / моменты затяжки'], environment:['Environmental parameters','Экологические параметры'], recommended:['Recommended','Рекомендовано'], actual:['Used on this vehicle','Используется на автомобиле'],
    continue:['Continue discussion','Продолжить обсуждение'], sources:['Sources used','Использованные материалы'], sourceCount:['Sources','Источники'], eventCount:['Context events','События контекста'], symptoms:['Symptoms','Симптомы'], conditions:['Conditions','Условия'], confirmed_facts:['Confirmed facts','Подтверждённые факты'], checks_summary:['Already checked','Что проверено'], hypotheses:['Hypotheses','Гипотезы'], actions_summary:['Actions taken','Выполненные действия'], current_conclusion:['Current conclusion','Текущий вывод'], next_step:['Next step','Следующий шаг'], confirmation:['Confirmed result','Подтверждённый результат'], started:['Started','Начало'],
    OPEN:['Open','Открыта'], IN_PROGRESS:['Diagnosis in progress','Диагностика в процессе'], SOLVED:['Solved','Решена'], CLOSED:['Closed','Закрыта'], ARCHIVED:['Archived','В архиве'],
    editEntry:['Edit','Редактировать'], editProblem:['Edit problem','Редактировать проблему'], recordActions:['Record actions','Действия с записью'], problem:['Problem','Проблема'], created:['Created','Создана'], updated:['Updated','Обновлена'], problemSummary:['Problem summary','Описание проблемы'], partsConsumables:['Parts / Consumables','Запчасти / расходники'], workPerformed:['Work performed','Выполненные работы'], notes:['Notes','Примечания'], problemTitle:['Problem title','Название проблемы'], problemSymptoms:['Symptoms (one per line)','Симптомы (по одному в строке)'],
    save:['Save','Сохранить'], parameter:['Parameter','Параметр'],
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
  const wheelSpecLabels={wheel_rim_size:['Wheel / rim size','Размер диска'],tire_size:['Tire size','Размер шины'],tire_pressure:['Tire pressure','Давление в шинах'],tire_pressure_front:['Front tire pressure','Давление спереди'],tire_pressure_rear:['Rear tire pressure','Давление сзади']};
  function specRows(raw={}){return Array.isArray(raw.items)?raw.items:[];}
  function specValueList(rows,field){
    const values=rows.filter(row=>wheelSpecLabels[row.parameter_key]&&row[field]!=null&&row[field]!=='').map(row=>[wheelSpecLabels[row.parameter_key][getLanguage()==='ru'?1:0],row[field]]);
    return values.length?`<dl class="vehicle-data-list">${values.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(valueText(v))}</dd>`).join('')}</dl>`:notice('unavailable');
  }
  async function api(path,options={}) {
    const headers={...(await backendAuthHeaders()),...(options.body?{'Content-Type':'application/json'}:{})};
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
    el('carEmpty').hidden=!!vehicles.length||editing||!!vehicleSyncError;
    el('carVehicle').hidden=!vehicle||editing;el('carEditor').hidden=!editing;
    if(!vehicle||editing)return;
    el('vehicleTitle').textContent=getVehicleLabel(vehicle);
    el('vehicleYear').textContent=vehicle.year||text('unavailable');
    el('vehicleEngine').textContent=vehicle.engine||text('unavailable');
    el('vehicleFuel').textContent=vehicle.fuel||text('unavailable');
    el('vehicleDrive').textContent=vehicle.drive||text('unavailable');
    el('vehicleVin').textContent=vehicle.vin||text('unavailable');
    const currentPhoto=el('vehicleCurrentPhoto');
    currentPhoto.classList.toggle('has-photo',Boolean(vehicle.photoUrl));
    currentPhoto.style.backgroundImage=vehicle.photoUrl?`url("${vehicle.photoUrl.replaceAll('"','%22')}")`:'';
    const dots=el('vehiclePositionDots');
    dots.innerHTML=vehicles.length>1?vehicles.map(item=>`<span class="${item.id===vehicle.id?'active':''}"></span>`).join(''):'';
    dots.hidden=vehicles.length<2;
    document.querySelectorAll('[data-car-switch]').forEach(button=>{button.hidden=vehicles.length<2;button.disabled=vehicles.length<2;});
    setTab(tab);
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
    if(!state.errors.events){
      const relevant=state.events.filter(row=>['SERVICE','REPAIR'].includes(String(row.event_type||'').toUpperCase()));
      const attached=await Promise.allSettled(relevant.map(row=>api(`/api/storage/vehicle-events/${encodeURIComponent(row.id)}/files`)));
      if(request!==version||owner!==window.pulsCurrentUser?.id||loadVehicleProfile().id!==id)return;
      relevant.forEach((row,index)=>{if(attached[index].status==='fulfilled')row.attachments=attached[index].value.files||[];});
    }
    if(state.detail){
      const detail=state.detail;
      saveVehicleProfile(vehicleFromApi({...detail.vehicle,...specValues(detail.specs||{}),id:detail.vehicle.id}));
    }
    state.loading=false;render();
  }
  function problemCard(p){return `<button type="button" class="problem-card" data-car-problem="${esc(p.id)}"><strong>${esc(p.title||text('problems'))}</strong><span>${esc(text(p.status))}</span><small>${esc(text('started'))}: ${esc(date(p.first_seen_at||p.created_at))}</small></button>`;}
  function timeline(){
    // Structured technical records only. Conversation messages never enter this log.
    const factualEvents=new Set(['SYMPTOM','DTC','CHECK','REPAIR','SERVICE','MAINTENANCE','REPLACEMENT','RESULT','MILEAGE','NOTE']);
    const rows=state.events.filter(e=>factualEvents.has(String(e.event_type||'').toUpperCase())).map(e=>{const type=String(e.event_type||'').toUpperCase();return {...e,time:e.event_date||e.occurred_at||e.created_at,category:['SERVICE','MAINTENANCE'].includes(type)?'maintenance':['REPAIR','REPLACEMENT','RESULT'].includes(type)?'repairs':'event',recordKind:'event'};});
    for(const p of state.problems)rows.push({id:p.id,problem_id:p.id,title:p.title,description:[text(p.status),p.current_conclusion,Object.keys(p.confirmation||{}).length?valueText(p.confirmation):''].filter(Boolean).join('\n'),time:p.last_seen_at||p.updated_at||p.first_seen_at||p.created_at,mileage:p.mileage,category:'problems',recordKind:'problem',active:['OPEN','IN_PROGRESS'].includes(p.status)});
    return rows.sort((a,b)=>(Date.parse(b.time)||0)-(Date.parse(a.time)||0));
  }
  function matchesHistoryFilter(row){
    if(filter==='all')return true;
    if(filter==='problems')return row.recordKind==='problem'&&row.active;
    return row.recordKind==='event'&&row.category===filter;
  }
  function attachmentMarkup(files=[]){return files.length?`<div class="vehicle-event-files">${files.map(file=>`<button class="btn" type="button" data-car-file-download="${esc(file.id)}" data-car-file-name="${esc(file.original_filename||'attachment')}">📎 ${esc(file.original_filename||'Attachment')}</button>`).join('')}</div>`:'';}
  const warningIcon = () => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 20h18.4z"/><path d="M12 9v5m0 3h.01"/></svg>';
  function eventTypeIcon(category){if(category==='repairs')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6a4 4 0 0 0-5 5L4 16l4 4 5-5a4 4 0 0 0 5-5l-3 3-4-4z"/></svg>';if(category==='maintenance')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s6 7 6 12a6 6 0 0 1-12 0c0-5 6-12 6-12z"/><path d="M9 16c.5 1.2 1.5 2 3 2"/></svg>';return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16H6zM9 8h6m-6 4h6m-6 4h4"/></svg>';}
  function contextIcon(kind){const paths={symptoms:'<path d="M4 12h3l2-5 4 10 2-5h5"/>',checks:'<path d="m5 12 4 4L19 6"/>',hypotheses:'<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1.5 2-1.5 4h-5c0-2-.5-3-1.5-4z"/>',next:'<path d="M5 12h14m-5-5 5 5-5 5"/>',sources:'<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',events:'<path d="M6 4v3m12-3v3M4 9h16M5 6h14v14H5z"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]||paths.symptoms}</svg>`;}
  function problemIndicators(p,extra={}){
    const indicators=[];
    if(Array.isArray(p.symptoms)&&p.symptoms.length)indicators.push(['symptoms',text('symptoms'),p.symptoms.length]);
    if(p.checks_summary)indicators.push(['checks',text('checks_summary'),'']);
    if(Array.isArray(p.hypotheses)&&p.hypotheses.length)indicators.push(['hypotheses',text('hypotheses'),p.hypotheses.length]);
    if(p.next_step)indicators.push(['next',text('next_step'),'']);
    if(extra.sources)indicators.push(['sources',text('sourceCount'),extra.sources]);
    if(extra.events)indicators.push(['events',text('eventCount'),extra.events]);
    return indicators.length?`<div class="problem-context-indicators">${indicators.map(([kind,label,count])=>`<span title="${esc(label)}">${contextIcon(kind)}<i>${esc(label)}</i>${count!==''?`<b>${esc(count)}</b>`:''}</span>`).join('')}</div>`:'';
  }
  function recordActionsMarkup(row){
    if(row.recordKind!=='event'||!['SERVICE','REPAIR'].includes(String(row.event_type||'').toUpperCase()))return '';
    return `<details class="vehicle-record-actions"><summary aria-label="${esc(text('recordActions'))}">⋮</summary><div role="menu"><button type="button" role="menuitem" data-car-event-edit="${esc(row.id)}">${esc(text('editEntry'))}</button></div></details>`;
  }
  function problemActionsMarkup(problemId){
    return `<details class="vehicle-record-actions active-problem-actions"><summary aria-label="${esc(text('recordActions'))}">⋮</summary><div role="menu"><button type="button" role="menuitem" data-car-problem-edit="${esc(problemId)}">${esc(text('editEntry'))}</button><button type="button" role="menuitem" data-car-problem-continue="${esc(problemId)}">${esc(text('continue'))}</button></div></details>`;
  }
  function eventParts(data={}){
    const values=[];
    for(const key of ['parts','materials','consumables','components']){const raw=data?.[key],items=Array.isArray(raw)?raw:[raw];for(const item of items){const value=typeof item==='string'?item:item&&typeof item==='object'?(item.name||item.title||item.label||item.part_number||''):'';if(String(value).trim())values.push(String(value).trim());}}
    return [...new Set(values)].join(' · ');
  }
  function eventDetail(row){
    if(String(row.description||'').trim())return String(row.description).trim();
    const data={...(row.event_data||{})};for(const key of ['parts','materials','consumables','components'])delete data[key];
    return Object.keys(data).length?valueText(data):'';
  }
  const partsIcon = () => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 8 8-4 8 4-8 4zM4 8v9l8 4 8-4V8M12 12v9"/></svg>';
  function logMarkup(rows){return rows.length?`<ol class="vehicle-event-timeline">${rows.map(e=>{const actions=recordActionsMarkup(e),semantic=e.category==='repairs'?'repairs':e.category==='maintenance'?'maintenance':'neutral',detail=eventDetail(e),parts=eventParts(e.event_data),title=semantic==='repairs'||semantic==='maintenance'?`<button class="vehicle-event-open vehicle-event-title" type="button" data-car-event-open="${esc(e.id)}">${esc(e.title||e.event_type)}</button>`:e.problem_id?`<button class="log-problem vehicle-event-title" type="button" data-car-problem="${esc(e.problem_id)}">${esc(e.title||e.event_type)}</button>`:`<strong class="vehicle-event-title">${esc(e.title||e.event_type)}</strong>`;return `<li class="vehicle-timeline-row vehicle-timeline-${semantic}"><span class="vehicle-timeline-dot" aria-hidden="true"></span><div class="vehicle-timeline-meta"><time>${esc(date(e.time))}</time>${e.mileage!=null?`<small>${esc(e.mileage)} km</small>`:''}</div><article class="vehicle-event-card"><span class="vehicle-event-icon">${eventTypeIcon(semantic)}</span><div class="vehicle-event-content">${title}<p class="vehicle-event-description" ${detail?'':'aria-hidden="true"'}>${esc(detail)}</p>${parts?`<div class="vehicle-event-parts" title="${esc(text('partsConsumables'))}: ${esc(parts)}">${partsIcon()}<span>${esc(text('partsConsumables'))}</span><b>${esc(parts)}</b></div>`:''}${attachmentMarkup(e.attachments)}</div>${actions}</article></li>`;}).join('')}</ol>`:notice('noEvents');}
  function problemCardsMarkup(rows){
    if(!rows.length)return notice('noProblems');
    return `<div class="active-problem-list">${rows.map(row=>{const p=state.problems.find(item=>item.id===row.id)||row;const summary=((Array.isArray(p.symptoms)?p.symptoms.join('; '):'')||p.current_conclusion||p.checks_summary||'').slice(0,300);return `<article class="active-problem-card"><div class="active-problem-icon">${warningIcon()}</div><div class="active-problem-content"><div class="active-problem-heading"><button type="button" data-car-problem="${esc(p.id)}">${esc(p.title||text('problem'))}</button></div><div class="active-problem-dates">${esc(text('created'))} ${esc(date(p.first_seen_at||p.created_at))}${p.updated_at||p.last_seen_at?` · ${esc(text('updated'))} ${esc(date(p.updated_at||p.last_seen_at))}`:''}</div>${summary?`<p>${esc(summary)}</p>`:''}${problemIndicators(p)}</div>${problemActionsMarkup(p.id)}</article>`;}).join('')}</div>`;
  }
  function renderHistoryFilters(rows){
    const values={maintenance:rows.filter(row=>row.recordKind==='event'&&row.category==='maintenance').length,repairs:rows.filter(row=>row.recordKind==='event'&&row.category==='repairs').length,problems:rows.filter(row=>row.recordKind==='problem'&&row.active).length};
    for(const key of ['maintenance','repairs','problems']){const button=document.querySelector(`[data-car-filter="${key}"]`);if(!button)continue;button.innerHTML=`${key==='problems'?warningIcon():eventTypeIcon(key)}<span data-v2="${key}">${esc(text(key))}</span><b>${values[key]}</b>`;}
  }
  function specDisplayValue(row,kind){const value=row?.[`${kind}_value`],unit=row?.[`${kind}_unit`];return value!=null&&value!==''?[value,unit].filter(Boolean).join(' '):text('unavailable');}
  function specGroupKey(row){
    const category=String(row.category||'').toLowerCase(),key=String(row.parameter_key||'').toLowerCase();
    if(category.includes('wheel')||category.includes('tire'))return 'wheels';
    if(category.includes('filter')||category.includes('consum'))return 'consumables';
    if(category.includes('electric'))return 'electrical';
    if(category.includes('dimension')||category.includes('weight'))return 'dimensions';
    if(category.includes('service')||category.includes('torque'))return 'service';
    if(category.includes('environment')||key.includes('emission'))return 'environment';
    if(category.includes('fuel')||category.includes('capacity')||key==='tank')return 'fuelCapacities';
    if(category.includes('fluid')||category.includes('engine')||['displacement','power','torque','engine_type','cylinders'].includes(key))return 'engineFluids';
    return 'mainSpecs';
  }
  function specParameterMarkup(rows){
    return rows.map(row=>`<div class="vehicle-spec-parameter"><div><strong>${esc(row.parameter_name||row.parameter_key)}</strong><small>${esc(text('recommended'))}: ${esc(specDisplayValue(row,'recommended'))}</small><small>${esc(text('actual'))}: ${esc(specDisplayValue(row,'actual'))}</small></div><details class="vehicle-record-actions vehicle-spec-actions"><summary aria-label="${esc(text('recordActions'))}">⋮</summary><div role="menu"><button type="button" role="menuitem" data-car-spec-edit="${esc(row.parameter_key)}">${esc(text('editEntry'))}</button></div></details></div>`).join('');
  }
  function dataHeadingIcon(key){
    const paths={
      mainSpecs:'<path d="M4 17V9l3-4h10l3 4v8M6 17h12M7 13h10"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
      engineFluids:'<path d="M5 9h11l3 3v6H5zM8 9V6h6v3m-9 4H2"/><path d="M19 5s2 2.3 2 3.7a2 2 0 0 1-4 0C17 7.3 19 5 19 5z"/>',
      consumables:'<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
      wheels:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v5m0 6v5M4 12h5m6 0h5"/>',
      fuelCapacities:'<path d="M5 21V4h9v17M5 9h9M3 21h13M14 7h3l3 3v7a2 2 0 0 1-4 0v-5"/>',
      electrical:'<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 4v3m6-3v3m-8 6h4m6-2v4m-2-2h4"/>',
      dimensions:'<path d="M4 7h16M4 17h16M7 4 4 7l3 3m10-6 3 3-3 3M7 14l-3 3 3 3m10-6 3 3-3 3"/>',
      service:'<path d="M14 6a4 4 0 0 0-5 5L4 16l4 4 5-5a4 4 0 0 0 5-5l-3 3-4-4z"/>',
      environment:'<path d="M12 21c5-3 7-7 7-14-7 0-11 3-12 8 0 3 2 5 5 6zM7 18c2-3 5-5 9-7"/>'
    };
    return `<svg class="vehicle-data-heading-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[key]||paths.mainSpecs}</svg>`;
  }
  function renderSections(v){
    if(state.loading){renderHistoryFilters([]);['vehicleRecentLog','vehicleHistory','vehicleData'].forEach(id=>el(id).innerHTML=notice('loading'));return;}
    const rows=timeline(), warning=state.errors.events||state.errors.problems?errorBlock():'';
    renderHistoryFilters(rows);
    el('vehicleRecentLog').innerHTML=warning+logMarkup(rows.filter(row=>row.recordKind==='event'));
    const visible=rows.filter(matchesHistoryFilter),problemRows=visible.filter(row=>row.recordKind==='problem'),activeProblems=problemRows.filter(row=>row.active),timelineRows=visible.filter(row=>row.recordKind==='event'||(row.recordKind==='problem'&&!row.active));
    el('vehicleHistory').innerHTML=warning+(filter==='problems'?problemCardsMarkup(activeProblems):`${timelineRows.length?logMarkup(timelineRows):''}${activeProblems.length?problemCardsMarkup(activeProblems):''}${!visible.length?notice('noEvents'):''}`);
    document.querySelectorAll('[data-car-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.carFilter===filter)));
    if(state.errors.detail){el('vehicleData').innerHTML=errorBlock();return;}
    const rawSpecs=state.detail?.specs||{},items=specRows(rawSpecs);
    const groups=[['mainSpecs',[['Make',v.brand],['Model',v.model],[text('generation'),v.generation],['Year',v.year],['VIN / chassis',v.vin],[text('mileage'),v.mileage?`${v.mileage} km`:'']]],['engineFluids',[['Engine',v.engine],['Transmission',v.transmission],['Drivetrain',v.drive]]],['consumables',[]],['wheels',[]],['fuelCapacities',[['Fuel',v.fuel]]],['electrical',[]],['dimensions',[]],['service',[]],['environment',[]]];
    el('vehicleData').innerHTML=groups.map(([key,entries],i)=>{const parameters=items.filter(row=>specGroupKey(row)===key),base=entries.some(([,x])=>x!=null&&x!=='')?`<dl class="vehicle-data-list">${entries.filter(([,x])=>x!=null&&x!=='').map(([k,x])=>`<dt>${esc(k)}</dt><dd>${esc(valueText(x))}</dd>`).join('')}</dl>`:'';return `<details class="vehicle-data-group" ${i===0?'open':''}><summary>${dataHeadingIcon(key)}<span>${esc(text(key))}</span></summary>${base}${parameters.length?`<div class="vehicle-spec-parameters">${specParameterMarkup(parameters)}</div>`:base?'':notice('unavailable')}</details>`;}).join('');
  }
  function modal(content){el('vehicleDialogContent').innerHTML=content;if(!el('vehicleDialog').open)el('vehicleDialog').showModal();}
  function close(){el('vehicleDialog').close();selectedProblem=null;}
  function editSpec(parameterKey){
    const row=specRows(state.detail?.specs||{}).find(item=>String(item.parameter_key)===String(parameterKey));if(!row)return;
    modal(`<h2>${esc(text('editEntry'))}</h2><div class="vehicle-spec-edit"><label><span>${esc(text('parameter'))}</span><strong>${esc(row.parameter_name||row.parameter_key)}</strong></label><label><span>${esc(text('recommended'))}</span><strong>${esc(specDisplayValue(row,'recommended'))}</strong></label><label><span>${esc(text('actual'))}</span><input id="vehicleSpecActualInput" value="${esc(row.actual_value||'')}" autocomplete="off"></label><div class="profile-actions"><button type="button" class="btn" data-car-action="close">${esc(text('cancel'))}</button><button type="button" class="btn blue" data-car-spec-save="${esc(row.parameter_key)}">${esc(text('save'))}</button></div></div>`);
    el('vehicleSpecActualInput')?.focus();
  }
  async function saveSpec(parameterKey,button){
    const row=specRows(state.detail?.specs||{}).find(item=>String(item.parameter_key)===String(parameterKey));if(!row)return;
    button.disabled=true;
    try{const result=await api(`/api/vehicles/${encodeURIComponent(state.id)}/specs/${encodeURIComponent(parameterKey)}`,{method:'PUT',body:JSON.stringify({actual_value:el('vehicleSpecActualInput')?.value||'',actual_unit:row.actual_unit||null})});const saved=result.spec;if(saved){const items=specRows(state.detail.specs),index=items.findIndex(item=>String(item.parameter_key)===String(parameterKey));items[index]=saved;}close();renderSections(loadVehicleProfile());}catch{button.disabled=false;toast(text('saveError'));}
  }
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
  function eventDetailModal(id){
    const row=state.events.find(item=>String(item.id)===String(id));if(!row)return;
    const type=String(row.event_type||'').toUpperCase();if(!['SERVICE','MAINTENANCE','REPAIR'].includes(type))return;
    const semantic=type==='REPAIR'?'repairs':'maintenance',parts=eventParts(row.event_data),description=String(row.description||'').trim(),notes=String(row.event_data?.notes||'').trim();
    modal(`<div class="vehicle-event-expanded vehicle-event-expanded-${semantic}"><header><span class="vehicle-event-icon">${eventTypeIcon(semantic)}</span><div><h2>${esc(row.title||row.event_type)}</h2><p>${esc(date(row.event_date||row.occurred_at||row.created_at))}${row.mileage!=null?` · ${esc(row.mileage)} km`:''}</p></div></header>${description?`<section class="vehicle-event-detail-block"><h3>${esc(text('workPerformed'))}</h3><p>${esc(description)}</p></section>`:''}${parts?`<section class="vehicle-event-detail-block vehicle-event-detail-parts"><h3>${partsIcon()}${esc(text('partsConsumables'))}</h3><p>${esc(parts)}</p></section>`:''}${notes?`<section class="vehicle-event-detail-block"><h3>${esc(text('notes'))}</h3><p>${esc(notes)}</p></section>`:''}${row.problem_id?`<section class="vehicle-event-detail-block"><button type="button" class="btn" data-car-problem="${esc(row.problem_id)}">${esc(text('problem'))}</button></section>`:''}${attachmentMarkup(row.attachments)}<div class="profile-actions"><button type="button" class="btn" data-car-action="close">${esc(text('close'))}</button>${['SERVICE','REPAIR'].includes(type)?`<button type="button" class="btn blue" data-car-event-edit="${esc(row.id)}">${esc(text('editEntry'))}</button>`:''}</div></div>`);
  }
  function editProblem(id){
    const p=state.problems.find(item=>String(item.id)===String(id));if(!p)return;
    modal(`<div class="active-problem-expanded active-problem-edit"><header><span class="active-problem-icon">${warningIcon()}</span><div><h2>${esc(text('editProblem'))}</h2><p>${esc(p.title||text('problem'))}</p></div></header><div class="vehicle-problem-edit"><label><span>${esc(text('problemTitle'))}</span><input id="vehicleProblemTitleInput" value="${esc(p.title||'')}"></label><label><span>${esc(text('problemSymptoms'))}</span><textarea id="vehicleProblemSymptomsInput" rows="6">${esc(Array.isArray(p.symptoms)?p.symptoms.join('\n'):'')}</textarea></label><div class="profile-actions"><button type="button" class="btn" data-car-action="close">${esc(text('cancel'))}</button><button type="button" class="btn blue" data-car-problem-save="${esc(p.id)}">${esc(text('save'))}</button></div></div></div>`);
    el('vehicleProblemTitleInput')?.focus();
  }
  async function saveProblem(id,button){
    const p=state.problems.find(item=>String(item.id)===String(id));if(!p)return;
    const title=String(el('vehicleProblemTitleInput')?.value||'').trim(),symptoms=String(el('vehicleProblemSymptomsInput')?.value||'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
    if(!title){el('vehicleProblemTitleInput')?.focus();return;}
    button.disabled=true;
    const payload={vehicle_id:p.vehicle_id,title,problem_class:p.problem_class||'OTHER',component:p.component||'',status:p.status||'OPEN',symptoms,conditions:p.conditions||{},confirmed_facts:p.confirmed_facts||[],hypotheses:p.hypotheses||[],checks_summary:p.checks_summary||'',actions_summary:p.actions_summary||'',current_conclusion:p.current_conclusion||'',next_step:p.next_step||'',mileage:p.mileage??null,confirmation:p.confirmation||{}};
    try{const data=await api(`/api/problems/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(payload)});const saved=data.problem;if(saved){const index=state.problems.findIndex(item=>String(item.id)===String(id));if(index>=0)state.problems[index]=saved;}close();renderSections(loadVehicleProfile());}catch{button.disabled=false;toast(text('saveError'));}
  }
  function continueProblem(p){if(!p)return;window.PulsChat.continueProblem(loadVehicleProfile(),p);close();showView('assistant');el('promptInput').focus();}
  async function problem(id){
    const vehicleId=loadVehicleProfile().id,owner=window.pulsCurrentUser?.id,request=version;
    selectedProblem=null;modal(notice('loading'));
    try{const data=await api(`/api/problems/${encodeURIComponent(id)}`);
      if(!el('vehicleDialog').open||request!==version||owner!==window.pulsCurrentUser?.id||vehicleId!==loadVehicleProfile().id)return;
      if(data.problem?.vehicle_id!==vehicleId)throw Error('Vehicle mismatch');
      const p=selectedProblem=data.problem;
      modal(`<div class="active-problem-expanded"><header><span class="active-problem-icon">${warningIcon()}</span><div><h2>${esc(p.title)}</h2><p>${esc(text('created'))} ${esc(date(p.first_seen_at||p.created_at))}${p.updated_at||p.last_seen_at?` · ${esc(text('updated'))} ${esc(date(p.updated_at||p.last_seen_at))}`:''}${p.mileage!=null?` · ${esc(p.mileage)} km`:''}</p></div></header>${problemIndicators(p,{sources:(data.sources||[]).length,events:(data.events||[]).length})}${['symptoms','conditions','confirmed_facts','checks_summary','hypotheses','actions_summary','current_conclusion','next_step','confirmation'].filter(k=>p[k]&&(typeof p[k]!=='object'||Object.keys(p[k]).length)).map(k=>`<section class="problem-detail"><h3>${esc(text(k))}</h3><p>${esc(valueText(p[k]))}</p></section>`).join('')}${sourceMarkup(data.sources)}<button type="button" class="btn active-problem-continue" data-car-action="continue">${esc(text('continue'))}</button></div>`);
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
  function switchVehicle(direction){
    const vehicles=loadVehicleStore().vehicles.filter(v=>isBackendVehicleId(v.id)&&v.lifecycle_status!=='TRASHED');
    if(vehicles.length<2)return;
    const current=vehicles.findIndex(v=>v.id===loadVehicleProfile().id);
    const step=direction==='previous'?-1:1;
    const next=vehicles[(Math.max(0,current)+step+vehicles.length)%vehicles.length];
    editing=false;++vehicleLookupRequestId;fillVehicleForm(setActiveVehicleProfile(next.id));tab='overview';filter='all';render();
  }
  function invalidate(){++version;state.id='';}
  function eventSaved(saved){if(!saved?.id||String(saved.vehicle_id)!==String(state.id))return;const index=state.events.findIndex(row=>String(row.id)===String(saved.id));if(index>=0)state.events[index]=saved;else state.events.unshift(saved);renderSections(loadVehicleProfile());}
  async function downloadFile(id,name){try{const response=await fetch(`${API_BASE_URL}/api/storage/files/${encodeURIComponent(id)}/download`,{headers:await backendAuthHeaders()});if(!response.ok)throw Error(`HTTP ${response.status}`);const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=name||'attachment';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{toast(text('loadError'));}}
  function authChanged(){const next=window.pulsCurrentUser?.id||'';if(next===authOwner)return;authOwner=next;++version;state={id:'',owner:'',loading:false,detail:null,problems:[],events:[],errors:{}};editing=false;selectedProblem=null;serverVehicleStore=null;++vehicleLookupRequestId;if(el('vehicleDialog')?.open)close();render();}
  function init(){
    if(initialized)return;initialized=true;authOwner=window.pulsCurrentUser?.id||'';
    i18n.en['car.formMileage']='Mileage (km)';i18n.ru['car.formMileage']='Пробег (км)';
    for(const lang of ['en','ru'])for(const key of ['car.lookupNotFound','car.lookupError','car.lookupInvalid','car.lookupNeedVin'])i18n[lang][key]=words.vinFailed[lang==='ru'?1:0];
    el('carCancelEdit').addEventListener('click',()=>{if(busy)return;editing=false;++vehicleLookupRequestId;fillVehicleForm(loadVehicleProfile());render();});
    el('mobileNavToggle').addEventListener('click',()=>{const opened=document.body.classList.toggle('navigation-open');el('mobileNavToggle').setAttribute('aria-expanded',String(opened));el('mobileNavBackdrop').hidden=!opened;});
    el('mobileNavBackdrop').addEventListener('click',closeNavigation);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeNavigation();if(event.target.matches('[data-car-tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const tabs=['overview','data','history'],index=event.key==='Home'?0:event.key==='End'?2:(tabs.indexOf(tab)+(event.key==='ArrowRight'?1:2))%3;setTab(tabs[index]);el(`tab-${tabs[index]}`).focus();}});
    document.addEventListener('click',async event=>{
      if(!event.target.closest('.vehicle-record-actions'))document.querySelectorAll('.vehicle-record-actions[open]').forEach(item=>item.removeAttribute('open'));
      const b=event.target.closest('[data-car-action],[data-car-tab],[data-car-filter],[data-car-problem],[data-car-problem-edit],[data-car-problem-save],[data-car-problem-continue],[data-car-event-open],[data-car-event-edit],[data-car-spec-edit],[data-car-spec-save],[data-car-file-download],[data-car-vehicle],[data-car-restore],[data-car-switch]');if(!b||b.disabled||busy)return;const d=b.dataset;
      if(d.carSwitch){switchVehicle(d.carSwitch);return;}
      if(d.carTab)return setTab(d.carTab);
      if(d.carFilter){filter=d.carFilter;renderSections(loadVehicleProfile());return;}
      if(d.carProblem)return problem(d.carProblem);
      if(d.carProblemEdit){document.querySelectorAll('.vehicle-record-actions[open]').forEach(item=>item.removeAttribute('open'));editProblem(d.carProblemEdit);return;}
      if(d.carProblemSave){await saveProblem(d.carProblemSave,b);return;}
      if(d.carProblemContinue){const p=state.problems.find(item=>String(item.id)===String(d.carProblemContinue));continueProblem(p);return;}
      if(d.carEventOpen){eventDetailModal(d.carEventOpen);return;}
      if(d.carFileDownload){await downloadFile(d.carFileDownload,d.carFileName);return;}
      if(d.carEventEdit){document.querySelectorAll('.vehicle-record-actions[open]').forEach(item=>item.removeAttribute('open'));const row=state.events.find(item=>String(item.id)===String(d.carEventEdit));if(row){if(el('vehicleDialog').open)close();window.PulsService.open({vehicleId:state.id,event:row});}return;}
      if(d.carSpecEdit){document.querySelectorAll('.vehicle-record-actions[open]').forEach(item=>item.removeAttribute('open'));editSpec(d.carSpecEdit);return;}
      if(d.carSpecSave){await saveSpec(d.carSpecSave,b);return;}
      if(d.carVehicle){editing=false;++vehicleLookupRequestId;fillVehicleForm(setActiveVehicleProfile(d.carVehicle));tab='overview';filter='all';render();return;}
      if(d.carRestore){b.disabled=true;try{await api(`/api/vehicles/${encodeURIComponent(d.carRestore)}/restore`,{method:'POST'});close();await syncVehicleStoreFromBackend();invalidate();render();}catch{b.disabled=false;toast(text('loadError'));}return;}
      document.querySelectorAll('.vehicle-actions[open]').forEach(n=>n.open=false);
      switch(d.carAction){
        case 'add':beginEdit(true);break;case 'edit':beginEdit();break;case 'trash-list':await trashList();break;
        case 'vin':beginEdit();el('carVinInput').focus();break;
        case 'specs':beginEdit();document.querySelector('.vehicle-spec-editor').open=true;break;
        case 'photo':el('carPhotoInput').click();break;
        case 'method-vin':el('carVinInput').focus();break;case 'method-manual':el('carBrandInput').focus();break;
        case 'entry':window.PulsService.open({vehicleId:state.id});break;
        case 'retry':await syncVehicleStoreFromBackend();invalidate();render();break;
        case 'close':close();break;
        case 'continue':continueProblem(selectedProblem);break;
        case 'trash':modal(`<h2>${esc(text('deleteTitle'))}</h2>${notice('deleteHelp')}<div class="profile-actions"><button type="button" class="btn" data-car-action="close">${esc(text('cancel'))}</button><button type="button" class="btn danger-btn" data-car-action="confirm-trash">${esc(text('moveTrash'))}</button></div>`);break;
        case 'confirm-trash':b.disabled=true;try{await deleteVehicleFromBackend(loadVehicleProfile());close();await syncVehicleStoreFromBackend();invalidate();render();}catch{b.disabled=false;toast(text('loadError'));}break;
      }
    });
    let swipeStartX=null,swipeStartY=null;
    el('carVehicle').addEventListener('pointerdown',event=>{if(event.pointerType==='mouse')return;swipeStartX=event.clientX;swipeStartY=event.clientY;},{passive:true});
    el('carVehicle').addEventListener('pointerup',event=>{if(swipeStartX==null)return;const dx=event.clientX-swipeStartX,dy=event.clientY-swipeStartY;swipeStartX=swipeStartY=null;if(Math.abs(dx)>=55&&Math.abs(dx)>Math.abs(dy)*1.4)switchVehicle(dx>0?'previous':'next');},{passive:true});
    render();
  }
  return {init,render,translate,text,closeNavigation,authChanged,invalidate,eventSaved,isEditing(){return editing;},setBusy(value){busy=value;},photoReady(){return !busy&&!state.loading&&!state.errors.detail&&state.detail?.vehicle?.id===loadVehicleProfile().id;},saved(){editing=false;invalidate();render();}};
})();
