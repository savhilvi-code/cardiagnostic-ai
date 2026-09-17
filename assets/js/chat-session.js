// Backend messages are authoritative. Local state contains IDs/timestamps only.
window.PulsChat = (() => {
  const CHAT_SESSION_TTL_HOURS = 12;
  const TTL = CHAT_SESSION_TTL_HOURS * 60 * 60 * 1000;
  let owner = '', version = 0, marker = null, context = null, lastActivity = 0;
  let restoring = null, pendingProblemSelection = false;
  const key = () => `puls_current_chat_v2:${owner}`;
  const validTime = value => { const n=Date.parse(value); return Number.isFinite(n)?n:0; };
  function readMarker(){try{return JSON.parse(localStorage.getItem(key())||'null');}catch{return null;}}
  function store(){try{if(marker)localStorage.setItem(key(),JSON.stringify(marker));else localStorage.removeItem(key());}catch{/* Storage is optional. */}}
  function empty(message){
    const box=document.getElementById('messages');if(!box)return;
    box.innerHTML=`<div class="chat-empty-state">${escapeHtml(message||t('assistant.emptyAuthenticated'))}</div>`;
    document.body.classList.remove('chat-active');
  }
  function banner(){
    document.getElementById('chatProblemContext')?.remove();
    if(!marker?.problemId)return;
    const node=document.createElement('p');node.id='chatProblemContext';node.className='chat-context';
    node.textContent=context?.problem?.title || (getLanguage()==='ru'?'Обсуждение выбранной проблемы':'Discussion of the selected problem');
    document.querySelector('#assistant .head').appendChild(node);
  }
  function authChanged(){
    const next=window.pulsCurrentUser?.id||'';if(next===owner)return;
    owner=next;++version;restoring=null;pendingProblemSelection=false;context=null;marker=owner?readMarker():null;lastActivity=0;empty();banner();
  }
  async function messages(path){
    const headers=await backendAuthHeaders();if(!headers.Authorization)throw Error('Authentication required');
    const res=await fetch(`${API_BASE_URL}${path}`,{headers});if(!res.ok)throw Error(`Chat history returned ${res.status}`);
    const data=await res.json();return Array.isArray(data.items)?data.items:[];
  }
  // Visible session = the contiguous tail after the last 12-hour inactivity gap.
  function sessionRows(rows,now=Date.now()){
    const sorted=rows.map(r=>({...r,role:String(r.role||'').toLowerCase(),message_text:r.content ?? r.message_text,vehicle_id:r.vehicle_id||r.metadata?.vehicle_id,problem_id:r.problem_id||r.metadata?.problem_id})).filter(r=>['user','assistant'].includes(r.role)&&typeof r.message_text==='string'&&validTime(r.created_at)>0&&validTime(r.created_at)<=now+60000).sort((a,b)=>validTime(a.created_at)-validTime(b.created_at));
    if(!sorted.length || now-validTime(sorted.at(-1).created_at)>=TTL)return [];
    const id=sorted.at(-1).conversation_id;
    const scoped=sorted.filter(r=>r.conversation_id===id);let start=0;
    for(let i=1;i<scoped.length;i++)if(validTime(scoped[i].created_at)-validTime(scoped[i-1].created_at)>=TTL)start=i;
    return scoped.slice(start);
  }
  async function restore(){
    authChanged();if(!owner){empty();return;}if(api.sending)return;if(restoring)return restoring;
    const request=++version,user=owner;
    restoring=(async()=>{
      try{
        if(pendingProblemSelection){empty();banner();return;}
        const path='/api/history';
        const rows=await messages(path);
        if(request!==version||owner!==user||api.sending)return;
        const visible=sessionRows(rows);
        if(!visible.length){marker=null;lastActivity=0;context=null;store();empty();banner();return;}
        const latest=visible.at(-1);lastActivity=validTime(latest.created_at);
        marker={conversationId:latest.conversation_id,vehicleId:latest.vehicle_id||null,problemId:latest.problem_id||null,lastActivity};store();banner();
        const box=document.getElementById('messages');
        box.innerHTML=visible.map(row=>`<div class="bubble ${row.role==='user'?'user':''}">${row.role==='assistant'?'<strong>PULS</strong><br>':''}${linkifyText(row.message_text)}<small>${escapeHtml(new Date(row.created_at).toLocaleTimeString(currentLocale(),{hour:'2-digit',minute:'2-digit'}))}</small></div>`).join('');
        document.body.classList.add('chat-active');scrollMessagesToBottom();
      }catch(error){
        console.warn('Could not restore active conversation:',error);
        if(request===version&&owner===user&&!document.querySelector('#messages .bubble'))empty(getLanguage()==='ru'?'Не удалось восстановить текущий чат. Обновите страницу для повторной попытки.':'Could not restore the current chat. Refresh to retry.');
      }finally{if(request===version)restoring=null;}
    })();return restoring;
  }
  async function beforeSend(){
    authChanged();if(restoring)await restoring;
    const activity=lastActivity||marker?.lastActivity;
    if(activity&&Date.now()-activity>=TTL){marker=null;context=null;lastActivity=0;store();empty();banner();}
  }
  function requestContext(){
    const vehicle=marker?.vehicleId||loadVehicleProfile().id;
    return {...(marker?.conversationId?{conversation_id:marker.conversationId}:{}),...(isBackendVehicleId(vehicle)?{vehicle_id:vehicle}:{}),...(marker?.problemId?{problem_id:marker.problemId}:{})};
  }
  async function afterSend(response,user){
    if(user!==window.pulsCurrentUser?.id||owner!==user)return;
    if(!response.conversation_id)return;
    pendingProblemSelection=false;
    marker={conversationId:response.conversation_id,vehicleId:response.vehicle_id||null,problemId:response.problem_id||null,lastActivity:0};
    try{
      const rows=await messages(`/api/conversations/${encodeURIComponent(marker.conversationId)}/messages`);
      if(user!==window.pulsCurrentUser?.id||owner!==user)return;
      const visible=sessionRows(rows);
      lastActivity=visible.length?validTime(visible.at(-1).created_at):0;
      marker.lastActivity=lastActivity;store();
    }catch{ /* Keep the response visible; recover authoritative activity on refresh. */ }
  }
  function continueProblem(vehicle,problem){
    authChanged();++version;restoring=null;
    pendingProblemSelection=true;
    context={vehicle:{id:vehicle.id,label:getVehicleLabel(vehicle)},problem:structuredClone(problem)};
    marker={conversationId:null,vehicleId:vehicle.id,problemId:problem.id,lastActivity:0};lastActivity=0;store();empty();banner();
  }
  const api={CHAT_SESSION_TTL_HOURS,sessionRows,restore,authChanged,beforeSend,requestContext,afterSend,continueProblem,sending:false};
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&document.readyState==='complete'&&!api.sending)void restore();
  });
  window.addEventListener('pageshow',event=>{if(event.persisted)void restore();});
  return api;
})();
