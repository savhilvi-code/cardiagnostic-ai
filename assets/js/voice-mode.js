(() => {
  function createVadGate({
    startThreshold=.026,
    endThreshold=.014,
    silenceMs=950,
    minSpeechMs=260,
    maxSpeechMs=30000
  }={}){
    let active=false;
    let noiseFloor=.008;
    let startedAt=0;
    let lastVoiceAt=0;
    return {
      sample(level,now){
        const value=Math.max(0,Number(level)||0);
        if(!active){
          noiseFloor=noiseFloor*.96+Math.min(value,.04)*.04;
          if(value>Math.max(startThreshold,noiseFloor*2.7)){
            active=true;startedAt=now;lastVoiceAt=now;return 'start';
          }
          return null;
        }
        if(value>Math.max(endThreshold,noiseFloor*1.65))lastVoiceAt=now;
        if((now-startedAt)>=maxSpeechMs||((now-startedAt)>=minSpeechMs&&(now-lastVoiceAt)>=silenceMs)){
          active=false;return 'end';
        }
        return null;
      },
      reset(){active=false;startedAt=0;lastVoiceAt=0;noiseFloor=.008;},
      get active(){return active;}
    };
  }
  function createRecorderLifecycle({createRecorder,onBlob,onError}){
    let session=null;
    return {
      start(stream,mimeType,context={}){
        if(session)return false;
        let recorder;
        try{recorder=createRecorder(stream,mimeType);}
        catch(error){onError?.({error},context);return false;}
        const current={recorder,chunks:[],canceled:false,mimeType:recorder.mimeType||mimeType||'audio/webm',context};
        session=current;
        recorder.addEventListener('dataavailable',event=>{
          if(!current.canceled&&event.data?.size)current.chunks.push(event.data);
        });
        recorder.addEventListener('error',event=>{
          current.canceled=true;
          if(session===current)session=null;
          current.chunks=[];
          onError?.(event,current.context);
        },{once:true});
        recorder.addEventListener('stop',()=>{
          if(session===current)session=null;
          if(current.canceled)return;
          const blob=new Blob(current.chunks,{type:current.mimeType});
          current.chunks=[];
          onBlob?.(blob,current.context);
        },{once:true});
        try{recorder.start();}
        catch(error){
          session=null;current.canceled=true;current.chunks=[];
          onError?.({error},current.context);return false;
        }
        return true;
      },
      stop(){
        if(!session||session.recorder.state!=='recording')return false;
        try{session.recorder.stop();}
        catch(error){
          const current=session;session=null;current.canceled=true;current.chunks=[];
          onError?.({error},current.context);return false;
        }
        return true;
      },
      cancel(){
        const current=session;
        if(!current)return;
        session=null;current.canceled=true;current.chunks=[];
        if(current.recorder.state!=='inactive'){
          try{current.recorder.stop();}catch{/* Recorder may already be stopping. */}
        }
      },
      get active(){return Boolean(session);}
    };
  }
  function startupGreeting(language='en'){
    return String(language).toLowerCase().startsWith('ru')
      ? 'Привет! Пульс на связи. Как твои дела?'
      : 'Hi! PULS here. How are you doing?';
  }
  const stateSevenWorkspaceCollapseComplete=.66;
  function stateSevenSmoothstep(edge0,edge1,value){
    const unit=Math.max(0,Math.min(1,(value-edge0)/(edge1-edge0)));
    return unit*unit*(3-2*unit);
  }
  function stateSevenWorkspaceOpen(progress){
    return stateSevenSmoothstep(stateSevenWorkspaceCollapseComplete,.99,progress);
  }
  function stateSevenBeamGate(progress,target){
    if(target!==0)return 1;
    return 1-stateSevenSmoothstep(.60,stateSevenWorkspaceCollapseComplete,progress);
  }
  function shouldEnterVoiceIdle({now,lastActivity,timeout,utteranceActive=false,processing=false}){
    return !utteranceActive&&!processing&&now-lastActivity>=timeout;
  }
  function voiceViewportGeometry(width,height){
    const resolvedWidth=Math.max(1,Number(width)||1);
    const resolvedHeight=Math.max(1,Number(height)||1);
    return {width:resolvedWidth,height:resolvedHeight,cx:resolvedWidth*.5,cy:resolvedHeight*.47};
  }
  const voiceNavigationTargets=Object.freeze({
    workspace:'conversation',vehicle:'car',my_vehicle:'car',technical_data:'technicalData',vehicle_history:'vehicleHistory',
    repairs:'repairs',maintenance:'maintenance',active_problems:'activeProblems'
  });
  const voiceNavigationActions=new Set([
    ...Object.keys(voiceNavigationTargets),'back','voice_interface','scroll_down','scroll_up',
    'scroll_top','scroll_bottom','text_interface'
  ]);
  function validatedVoiceNavigationAction(action){
    const normalized=String(action||'');
    return voiceNavigationActions.has(normalized)?normalized:null;
  }
  function voiceScrollTarget({assistantMode=false,messages=null,mainPanel=null,scrollingElement=null}={}){
    if(assistantMode&&messages)return messages;
    return mainPanel||scrollingElement||null;
  }
  function voiceScrollTop(action,target){
    const current=Math.max(0,Number(target?.scrollTop)||0);
    const viewport=Math.max(1,Number(target?.clientHeight)||1);
    const bottom=Math.max(0,(Number(target?.scrollHeight)||0)-viewport);
    if(action==='scroll_top')return 0;
    if(action==='scroll_bottom')return bottom;
    const distance=Math.max(120,viewport*.86);
    return Math.max(0,Math.min(bottom,current+(action==='scroll_up'?-distance:distance)));
  }
  function voiceNavigationPlan(action,current='conversation',history=[]){
    const safeHistory=Array.isArray(history)?history.filter(Boolean):[];
    if(action==='back'){
      if(!safeHistory.length)return {target:null,current,history:safeHistory};
      const nextHistory=safeHistory.slice(0,-1);
      const target=safeHistory.at(-1);
      return {target,current:target,history:nextHistory};
    }
    const target=voiceNavigationTargets[action]||null;
    if(!target)return {target:null,current,history:safeHistory};
    if(target===current)return {target,current,history:safeHistory};
    return {target,current:target,history:[...safeHistory,current].filter(Boolean).slice(-12)};
  }
  async function coordinateVoiceNavigation(navigation,{dispatch,prepareAudio,playAudio}){
    const run=dispatch(navigation);
    if(!run?.started)return false;
    const audioTask=Promise.resolve().then(prepareAudio).then(audio=>audio?playAudio(audio):false);
    await Promise.allSettled([run.completion,audioTask]);
    return true;
  }
  // A pure seam used by the focused VAD regression test.
  window.PulsVoiceVad={createVadGate};
  window.PulsVoiceGreeting={text:startupGreeting};
  window.PulsVoiceRecorder={createLifecycle:createRecorderLifecycle};
  window.PulsVoiceStateSeven={
    workspaceCollapseComplete:stateSevenWorkspaceCollapseComplete,
    workspaceOpen:stateSevenWorkspaceOpen,
    beamGate:stateSevenBeamGate
  };
  window.PulsVoiceIdle={shouldEnter:shouldEnterVoiceIdle};
  window.PulsVoiceLayout={geometry:voiceViewportGeometry};
  window.PulsVoiceNavigation={
    plan:voiceNavigationPlan,targets:voiceNavigationTargets,coordinate:coordinateVoiceNavigation,
    validateAction:validatedVoiceNavigationAction
  };
  window.PulsVoiceScroll={target:voiceScrollTarget,top:voiceScrollTop};

  const root = document.getElementById('pulsVoiceMode');
  const canvas = document.getElementById('pulsVoiceCanvas');
  const workspace = document.getElementById('app');
  const controls = document.getElementById('pulsVoiceControls');
  const attachButton = document.getElementById('pulsVoiceAttach');
  const toggleButton = document.getElementById('pulsVoiceToggle');
  const keyboardButton = document.getElementById('pulsVoiceKeyboard');
  const statusText = document.getElementById('pulsVoiceStatus');
  const headerIndicator = document.querySelector?.('.puls-voice-header-label')||null;
  if (!root || !canvas || !workspace || !controls || !attachButton || !toggleButton || !keyboardButton || !statusText) return;
  const ctx = canvas.getContext('2d');
  const voiceInactivityMs=Math.max(1000,Number(root.dataset.inactivityMs)||30000);
  let transitionProgress = 0, transitionTarget = 0, transitionLast = 0;
  let transitionActive = false;
  let pendingVoiceStart = false;
  let pendingTextExit = false;
  const transitionDuration = 2400;
  let active = false;
  let running = false;
  let animationFrame = 0;
  let controlsTimer = 0;
  let workspaceTimer = 0;
  let voiceSessionActive = false;
  let workspaceVisible = false;
  let voiceWorkspaceTarget='conversation';
  let voiceWorkspaceHistory=[];
  let stateBeforeWorkspace = 'standby';
  let microphoneStream = null;
  let microphoneContext = null;
  let microphoneSource = null;
  let microphoneAnalyser = null;
  let microphoneSamples = null;
  let vadFrame = 0;
  let processingUtterance = false;
  let currentPlayback = null;
  let voiceSessionEpoch = 0;
  let startupGreetingPlayed = false;
  let lastGenuineActivityAt=0;
  const vadGate=createVadGate();
  let statusTimer=0;
  let greetingManifestPromise=null;
  const greetingManifestUrl='assets/audio/voice-greetings/manifest.v1.json';
  let navigationAcknowledgementManifestPromise=null;
  const navigationAcknowledgementManifestUrl='assets/audio/voice-acknowledgements/manifest.v1.json';
  const silentNavigationActions=new Set([
    'scroll_down','scroll_up','scroll_top','scroll_bottom','text_interface'
  ]);
  const recorderLifecycle=createRecorderLifecycle({
    createRecorder(stream,mimeType){return new MediaRecorder(stream,mimeType?{mimeType}:undefined);},
    onBlob(blob,{epoch}){
      if(epoch!==voiceSessionEpoch||!voiceSessionActive)return;
      void submitUtterance(blob,epoch,{finalized:true});
    },
    onError(event,{epoch}){
      if(epoch!==voiceSessionEpoch||!voiceSessionActive)return;
      processingUtterance=false;vadGate.reset();
      console.warn('PULS voice pipeline failure',{stage:'recording',name:String(event?.error?.name||'MediaRecorderError')});
      notifyVoice(voiceMessage('recording'));
      setState('listening');
    }
  });

  // Ultra-crisp render: modest supersampling above the native CSS DPR.
  // Cap the backing-store density to avoid excessive GPU/memory load on mobile.
  const nativeDpr = Math.max(1, window.devicePixelRatio || 1);
  const dpr = Math.min(4.5, nativeDpr * 1.35);

  let W=0, H=0, CX=0, CY=0, SX=0, SY=0, ringR=0;
  let state = 'summon';
  let stateSince = performance.now();
  let previousState = null, previousStateSince = 0, blendStarted = 0;
  const blendDuration = 850;
  const validStates = new Set(['summon', 'listening', 'thinking', 'responding', 'disappearing', 'standby']);

  const NX = 29, NY = 25;
  const grid = [];
  let thinkingNodes = [];

  // Gentle motion smoothing for non-thinking modes as an optional presentation layer.
  // It only interpolates positions / local alphas between frames and does not change the logic.
  let lastSpatialSmoothFrame = 0;
  const spatialCaches = {
    summon: null,
    listening: null,
    responding: null,
    disappearing: null,
    standby: null
  };

  function smoothGridRows(rows, cacheKey, time, strength = 7.0) {
    const dt = lastSpatialSmoothFrame ? Math.min(0.05, (time - lastSpatialSmoothFrame) / 1000) : 0;
    lastSpatialSmoothFrame = time;
    const ease = dt > 0 ? (1 - Math.exp(-dt * strength)) : 1;

    let cache = spatialCaches[cacheKey];
    if (!cache || cache.length !== rows.length || cache[0].length !== rows[0].length) {
      cache = rows.map(row => row.map(p => ({...p})));
      spatialCaches[cacheKey] = cache;
      return rows;
    }

    for (let iy = 0; iy < rows.length; iy++) {
      for (let ix = 0; ix < rows[iy].length; ix++) {
        const src = rows[iy][ix];
        const dst = cache[iy][ix];
        dst.x = lerp(dst.x, src.x, ease);
        dst.y = lerp(dst.y, src.y, ease);
        dst.lineAlpha = lerp(dst.lineAlpha, src.lineAlpha, ease);
        dst.nodeAlpha = lerp(dst.nodeAlpha, src.nodeAlpha, ease);
        dst.extraNode = lerp(dst.extraNode, src.extraNode, ease);
        dst.centerPull = src.centerPull;
      }
    }
    return cache;
  }

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t){ return a + (b - a) * t; }
  function smoothstep(a, b, x){
    const t = clamp((x-a)/(b-a), 0, 1);
    return t*t*(3-2*t);
  }
  function dist(x1,y1,x2,y2){
    const dx=x2-x1, dy=y2-y1;
    return Math.hypot(dx,dy);
  }

  function resize() {
    const bounds=root.getBoundingClientRect();
    const geometry=voiceViewportGeometry(
      root.clientWidth||bounds.width||window.innerWidth,
      root.clientHeight||bounds.height||window.innerHeight
    );
    W = geometry.width;
    H = geometry.height;
    canvas.width = Math.ceil(W * dpr);
    canvas.height = Math.ceil(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    CX = geometry.cx;
    CY = geometry.cy;
    SX = Math.min(W, H) * 0.40;
    SY = Math.min(W, H) * 0.29;
    ringR = Math.min(W, H) * 0.102;
    buildBaseGrid();
    buildThinkingNodes();
  }

  function buildBaseGrid(){
    grid.length = 0;
    for (let iy=0; iy<NY; iy++) {
      const row = [];
      const v = iy/(NY-1);
      const yy = (v - 0.5) * 2;
      for (let ix=0; ix<NX; ix++) {
        const u = ix/(NX-1);
        const xx = (u - 0.5) * 2;
        const r = Math.hypot(xx, yy);
        const a = Math.atan2(yy, xx);
        row.push({u,v,xx,yy,r,a,ix,iy});
      }
      grid.push(row);
    }
  }

  function buildThinkingNodes() {
    thinkingNodes = [];
    const count = 82;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.pow(Math.random(), 0.72) * 1.0;
      const shell = 0.28 + radius * 0.84;
      const x = Math.cos(angle) * shell;
      const y = Math.sin(angle) * shell * (0.84 + Math.random() * 0.28);
      thinkingNodes.push({
        x0: x,
        y0: y,
        size: 1.2 + Math.random() * 1.8,
        pulse: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.6,
        drift: 0.2 + Math.random() * 0.4,
        spark: Math.random(),
        bright: 0.4 + Math.random() * 0.6
      });
    }
  }

  window.addEventListener('resize', () => { if (active) resize(); });
  window.visualViewport?.addEventListener('resize',()=>{if(active)resize();});

  function setState(next){
    if (!validStates.has(next)) return;
    if(headerIndicator)headerIndicator.dataset.voiceState=next==='responding'?'speaking':next==='thinking'?'thinking':next==='listening'?'listening':'idle';
    if (next === state && previousState === null) return;
    previousState = state;
    previousStateSince = stateSince;
    blendStarted = performance.now();
    state = next;
    stateSince = performance.now();
    if (next === 'thinking') lastThinkingFrame = 0;
    lastSpatialSmoothFrame = 0;
  }

  // Phase 2 integration point: visual envelopes accept real audio levels later.
  const audioLevels = {listening:0, responding:0};
  const audioTargets = {listening:0, responding:0};
  const audioUpdated = {listening:0, responding:0};
  const audioContexts = [];
  window.PULSVoiceVisual = {
    setAudioLevel(mode, value) {
      if (!(mode in audioTargets)) return;
      audioTargets[mode]=clamp(Number(value)||0,0,1);
      audioUpdated[mode]=performance.now();
    },
    connectAudioElement(element) {
      const ac=new (window.AudioContext||window.webkitAudioContext)();
      const source=ac.createMediaElementSource(element);
      const analyser=ac.createAnalyser();analyser.fftSize=1024;
      source.connect(analyser);analyser.connect(ac.destination);
      audioContexts.push({ac,analyser,element,mode:'responding',samples:new Uint8Array(analyser.fftSize)});
      ac.resume();return ac;
    },
    disconnectAudioElement(element) {
      for(let index=audioContexts.length-1;index>=0;index--){
        const item=audioContexts[index];
        if(item.element!==element)continue;
        audioContexts.splice(index,1);
        void item.ac.close().catch(()=>{});
      }
    }
  };
  function updateAudioLevels(now){
    for(const source of audioContexts){
      source.analyser.getByteTimeDomainData(source.samples);
      let power=0;
      for(const byte of source.samples){const v=(byte-128)/128;power+=v*v;}
      const rms=Math.sqrt(power/source.samples.length);
      audioTargets[source.mode]=clamp((rms-.008)*6.5,0,1);
      audioUpdated[source.mode]=now;
    }
    for(const mode of ['listening','responding']){
      const fresh=now-audioUpdated[mode]<250;
      const target=fresh?audioTargets[mode]:0;
      const easing=target>audioLevels[mode]?.28:.075;
      audioLevels[mode]+= (target-audioLevels[mode])*easing;
    }
  }
  function voiceLevelListening(t){return audioLevels.listening;}
  function voiceLevelResponding(t){return audioLevels.responding;}

  function ringSignal(theta, tSec, mode) {
    const voice = mode === 'listening' ? voiceLevelListening(tSec) : voiceLevelResponding(tSec);
    const speed = mode === 'listening' ? 1.75 : 2.25;

    const low = Math.sin(theta * 2 - tSec * speed * 1.5 + 0.4) * (0.20 + voice * 0.18);
    const mid = Math.sin(theta * 5 + tSec * speed * 1.9 + 1.5) * (0.14 + voice * 0.15);
    const high = Math.sin(theta * 11 - tSec * speed * 2.7 + 0.8) * (0.07 + voice * 0.12);
    const sparkle = Math.sin(theta * 17 + tSec * speed * 3.3 + 2.1) * (0.03 + voice * 0.08);

    let s = (low + mid + high + sparkle) * (0.68 + voice * 0.65);
    const pulse = Math.max(0, s);
    const softer = 0.08 * Math.sin(theta * 3 + tSec * 1.1);
    return {
      value: pulse + softer,
      brightness: 0.28 + pulse * 0.9 + voice * 0.25,
      voice
    };
  }

  function getDisappearProgress() {
    const elapsed = (performance.now() - stateSince) / 1000;
    const duration = 3.0;
    return clamp(elapsed / duration, 0, 1);
  }

  function computeGridPoint(p, tSec){
    const edge = Math.max(Math.abs(p.xx), Math.abs(p.yy));
    const a = p.a;
    const r0 = p.r;
    const centerPull = Math.pow(Math.max(0, 1 - clamp(r0 / 1.25, 0, 1)), 2.2);

    const angularWarp =
      Math.sin(a * 3 + tSec * 0.42) * 0.022 +
      Math.cos(a * 5 - tSec * 0.28) * 0.012 +
      Math.sin((p.xx - p.yy) * 2.7) * 0.010;

    const scale = 1 - centerPull * 0.38 + angularWarp;
    let x = p.xx * SX * scale;
    let y = p.yy * SY * scale;

    x -= Math.cos(a) * centerPull * 42;
    y -= Math.sin(a) * centerPull * 30;

    let lineAlpha = 0.02;
    let nodeAlpha = 0.04;
    let extraNode = 0.0;

    const px0 = CX + x;
    const py0 = CY + y;
    const dx0 = px0 - CX;
    const dy0 = py0 - CY;
    const rr = Math.hypot(dx0, dy0);
    const th = Math.atan2(dy0, dx0);
    const band = Math.exp(-Math.pow((rr - ringR) / (ringR * 0.18), 2));

    if (state === 'summon') {
      const progress = smoothstep(0, 1.55, (performance.now() - stateSince) / 1000);
      const revealRadius = lerp(0.00, 1.18, progress);
      const reveal = smoothstep(revealRadius + 0.10, revealRadius - 0.03, r0);

      const pull = (1 - progress) * 0.72;

      // Original v7 formation, but with one important correction:
      // every not-yet-revealed node stays exactly at CX/CY.
      // This removes the stray side point visible in the old summon.
      x = lerp(0, x, reveal);
      y = lerp(0, y, reveal);

      x += Math.cos(a) * (-pull * 22 * (1 - r0 * 0.45)) * reveal;
      y += Math.sin(a) * (-pull * 16 * (1 - r0 * 0.45)) * reveal;

      lineAlpha = 0.010 + reveal * (0.09 + centerPull * 0.32) + progress * 0.03;
      nodeAlpha = 0.015 + reveal * (0.14 + centerPull * 0.48);
      extraNode = reveal * (0.22 + centerPull * 0.35);
    }

    if (state === 'listening' || state === 'responding') {
      const sig = ringSignal(th, tSec, state);
      const local = band * sig.value;

      // Radial travelling ripple across the WHOLE mesh, not a uniform pulse.
      // Listening: phase fronts move inward. Responding: phase fronts move outward.
      // Phase velocity is controlled by the sign in front of time.
      const radialDistance = Math.hypot(x, y);
      const waveSpeed = 85; // CSS px / second
      const waveLength = Math.max(54, Math.min(W,H) * 0.23);
      const direction = state === 'listening' ? 1 : -1;
      const phase = (radialDistance + direction * tSec * waveSpeed) * (Math.PI * 2 / waveLength);
      const meshEnvelope = smoothstep(0, ringR * 0.45, radialDistance)
        * (1 - smoothstep(Math.min(W,H)*0.31, Math.min(W,H)*0.53, radialDistance));
      const travellingRipple = Math.sin(phase) * 6.8 * meshEnvelope;
      x += Math.cos(th) * travellingRipple;
      y += Math.sin(th) * travellingRipple;

      const radialDisp = local * ringR * 0.29;
      x += Math.cos(th) * radialDisp;
      y += Math.sin(th) * radialDisp;

      const tang = band * sig.voice * 3.6 * Math.sin(th * 6 + tSec * (state === 'listening' ? 3.0 : 2.35));
      x += -Math.sin(th) * tang;
      y +=  Math.cos(th) * tang;

      lineAlpha = 0.03 + centerPull * 0.10 + band * (0.08 + sig.brightness * 0.22);
      nodeAlpha = 0.05 + centerPull * 0.14 + band * (0.12 + sig.brightness * 0.32);
      extraNode = band * sig.brightness * 0.86;
    }

    if (state === 'disappearing') {
      const pgr = getDisappearProgress();
      const fade = 1 - smoothstep(0.0, 0.92, pgr);
      const collapse = smoothstep(0.0, 1.0, pgr);

      // Start from faint visible web + central ring, then collapse inward.
      x *= fade;
      y *= fade;
      const attract = collapse * collapse * (28 + centerPull * 30);
      x -= Math.cos(a) * attract * (0.35 + centerPull * 0.65);
      y -= Math.sin(a) * attract * (0.28 + centerPull * 0.62);

      const faintBand = band * (0.16 + 0.10 * (1 - pgr));
      lineAlpha = (0.012 + centerPull * 0.045 + faintBand) * fade;
      nodeAlpha = (0.02 + centerPull * 0.08 + faintBand * 1.3) * fade;
      extraNode = (0.08 + centerPull * 0.16 + band * 0.22) * fade;
    }

    const webFade = 1 - smoothstep(0.70, 1.02, edge);
    lineAlpha *= lerp(0.08, 1.0, webFade);
    nodeAlpha *= lerp(0.12, 1.0, webFade);

    const fringe = clamp((edge - 0.55) / 0.45, 0, 1);
    lineAlpha += fringe * 0.015 * (state === 'disappearing' ? 0.4 : 1);
    nodeAlpha += fringe * 0.025 * (state === 'disappearing' ? 0.4 : 1);

    return {
      x: CX + x,
      y: CY + y,
      lineAlpha: clamp(lineAlpha, 0, 1),
      nodeAlpha: clamp(nodeAlpha, 0, 1),
      extraNode: clamp(extraNode, 0, 1),
      centerPull
    };
  }

  function drawBackground(){
    ctx.clearRect(0,0,W,H);

    let bgFade = 1;
    if (state === 'disappearing') {
      bgFade = 1 - smoothstep(0.55, 1.0, getDisappearProgress());
    }
    if (bgFade <= 0.001) return;

    const glow = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.min(W,H)*0.34);
    glow.addColorStop(0, `rgba(8,108,255,${(0.10 * bgFade).toFixed(3)})`);
    glow.addColorStop(0.28, `rgba(0,61,180,${(0.045 * bgFade).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(CX, CY, Math.min(W,H)*0.34, 0, Math.PI*2);
    ctx.fill();
  }

  function drawWebState(time) {
    const tSec = time * 0.001;
    const rawComputed = [];
    for (let iy=0; iy<NY; iy++) {
      const row = [];
      for (let ix=0; ix<NX; ix++) row.push(computeGridPoint(grid[iy][ix], tSec));
      rawComputed.push(row);
    }
    const computed = smoothGridRows(rawComputed, state, time, 7.8);

    function drawLine(a, b, alphaMul=1.0, width=1.0){
      const alpha = Math.min(a.lineAlpha, b.lineAlpha) * alphaMul;
      if (alpha < 0.01) return;
      ctx.strokeStyle = `rgba(74,168,255,${alpha.toFixed(3)})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.lineCap = 'round';
    for (let iy=0; iy<NY; iy++) {
      for (let ix=0; ix<NX; ix++) {
        const p = computed[iy][ix];
        if (ix < NX-1) drawLine(p, computed[iy][ix+1], 1.0, 0.95);
        if (iy < NY-1) drawLine(p, computed[iy+1][ix], 1.0, 0.95);
        if (ix < NX-1 && iy < NY-1 && (ix+iy)%2===0) drawLine(p, computed[iy+1][ix+1], 0.30, 0.72);
        if (ix > 0 && iy < NY-1 && (ix+iy)%3===0) drawLine(p, computed[iy+1][ix-1], 0.16, 0.68);
      }
    }

    for (let iy=0; iy<NY; iy++) {
      for (let ix=0; ix<NX; ix++) {
        const p = computed[iy][ix];
        if (p.nodeAlpha < 0.02) continue;
        const rr = 0.75 + p.centerPull * 1.3 + p.extraNode * 1.0;
        ctx.beginPath();
        ctx.shadowColor = 'rgba(38,119,255,0.85)';
        ctx.shadowBlur = 9;
        ctx.fillStyle = `rgba(80,207,255,${Math.min(1,p.nodeAlpha*1.14).toFixed(3)})`;
        ctx.arc(p.x, p.y, rr, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Crisp core over the glow; geometry/size stays unchanged.
        ctx.beginPath();
        ctx.fillStyle = `rgba(152,225,255,${(p.nodeAlpha*0.48).toFixed(3)})`;
        ctx.arc(p.x, p.y, Math.max(0.42, rr * 0.48), 0, Math.PI*2);
        ctx.fill();
      }
    }

    if (state === 'listening' || state === 'responding') {
      const steps = 220;
      ctx.lineWidth = 1.15;
      for (let i=0; i<steps; i++) {
        const a1 = (i / steps) * Math.PI * 2;
        const a2 = ((i+1) / steps) * Math.PI * 2;
        const s1 = ringSignal(a1, tSec, state);
        const s2 = ringSignal(a2, tSec, state);
        const r1 = ringR + Math.max(0, s1.value) * ringR * 0.23;
        const r2 = ringR + Math.max(0, s2.value) * ringR * 0.23;
        const alpha = ((s1.brightness + s2.brightness) * 0.5) * 0.25;
        ctx.strokeStyle = `rgba(63,201,255,${alpha.toFixed(3)})`;
        ctx.shadowColor = 'rgba(38,119,255,0.35)';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(CX + Math.cos(a1) * r1, CY + Math.sin(a1) * r1);
        ctx.lineTo(CX + Math.cos(a2) * r2, CY + Math.sin(a2) * r2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Thin sharp center stroke, preserving the existing glow around it.
        ctx.strokeStyle = `rgba(154,227,255,${(alpha * 0.62).toFixed(3)})`;
        ctx.lineWidth = 0.58;
        ctx.beginPath();
        ctx.moveTo(CX + Math.cos(a1) * r1, CY + Math.sin(a1) * r1);
        ctx.lineTo(CX + Math.cos(a2) * r2, CY + Math.sin(a2) * r2);
        ctx.stroke();
      }
    }

    if (state === 'disappearing') {
      drawDisappearCore();
    } else {
      drawCenterCore(tSec);
    }
  }

  function drawCenterCore(tSec) {
    if (state === 'thinking' || state === 'disappearing') return;

    let voice = 0.25;
    if (state === 'listening') voice = voiceLevelListening(tSec);
    if (state === 'responding') voice = voiceLevelResponding(tSec);

    if (state === 'summon') {
      const p = smoothstep(0, 1.2, (performance.now() - stateSince) / 1000);

      const halo = ctx.createRadialGradient(CX, CY, 0, CX, CY, ringR * (0.50 + p * 0.85));
      halo.addColorStop(0, `rgba(80,207,255,${(0.36 + p * 0.18).toFixed(3)})`);
      halo.addColorStop(0.18, `rgba(38,119,255,${(0.16 + p * 0.12).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(CX, CY, ringR * (0.55 + p * 0.90), 0, Math.PI*2);
      ctx.fill();

      ctx.beginPath();
      ctx.shadowColor = 'rgba(38,119,255,1)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(80,207,255,.98)';
      ctx.arc(CX, CY, 2.0 + p * 2.4, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(220,248,255,.98)';
      ctx.arc(CX, CY, 1.0 + p * 1.05, 0, Math.PI*2);
      ctx.fill();

      if (p > 0.62) {
        const t = smoothstep(0.62, 1.0, p);
        const innerHole = ringR * (0.76 - t * 0.18);

        const gg = ctx.createRadialGradient(CX, CY, innerHole * 0.78, CX, CY, ringR * 1.62);
        gg.addColorStop(0, 'rgba(0,0,0,1)');
        gg.addColorStop(0.28, 'rgba(0,0,0,0.98)');
        gg.addColorStop(0.52, `rgba(38,119,255,${(0.08 + t * 0.16).toFixed(3)})`);
        gg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(CX, CY, ringR * 1.65, 0, Math.PI*2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = '#000';
        ctx.arc(CX, CY, innerHole, 0, Math.PI*2);
        ctx.fill();
      }
      return;
    }

    const innerHole = ringR * (0.58 + voice * 0.06);

    const gg = ctx.createRadialGradient(CX, CY, innerHole * 0.82, CX, CY, ringR * 1.65);
    gg.addColorStop(0, 'rgba(0,0,0,1)');
    gg.addColorStop(0.28, 'rgba(0,0,0,0.98)');
    gg.addColorStop(0.52, 'rgba(38,119,255,0.24)');
    gg.addColorStop(0.85, 'rgba(8,108,255,0.06)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(CX, CY, ringR * 1.7, 0, Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#000';
    ctx.arc(CX, CY, innerHole, 0, Math.PI*2);
    ctx.fill();
  }

  function drawDisappearCore() {
    const pgr = getDisappearProgress();

    // Ring/structure collapse.
    const structureFade = 1 - smoothstep(0.00, 0.78, pgr);
    const innerHole = ringR * lerp(0.58, 0.02, smoothstep(0.0, 0.78, pgr));

    if (structureFade > 0.001) {
      const gg = ctx.createRadialGradient(CX, CY, innerHole * 0.85, CX, CY, ringR * 1.35);
      gg.addColorStop(0, 'rgba(0,0,0,1)');
      gg.addColorStop(0.24, 'rgba(0,0,0,0.98)');
      gg.addColorStop(0.55, `rgba(38,119,255,${(0.18 * structureFade).toFixed(3)})`);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(CX, CY, ringR * 1.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(63,201,255,${(0.28 * structureFade).toFixed(3)})`;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.arc(CX, CY, Math.max(innerHole, 2.0), 0, Math.PI * 2);
      ctx.stroke();
    }

    // The collapse finishes in a point, then that point itself fades to black.
    const pointIn = smoothstep(0.52, 0.78, pgr);
    const pointOut = 1 - smoothstep(0.82, 1.00, pgr);
    const pointAlpha = pointIn * pointOut;

    if (pointAlpha > 0.001) {
      const haloR = 10 + pointIn * 10;
      const halo = ctx.createRadialGradient(CX, CY, 0, CX, CY, haloR);
      halo.addColorStop(0, `rgba(80,207,255,${(0.72 * pointAlpha).toFixed(3)})`);
      halo.addColorStop(0.28, `rgba(38,119,255,${(0.32 * pointAlpha).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(CX, CY, haloR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.shadowColor = 'rgba(38,119,255,1)';
      ctx.shadowBlur = 14 + pointIn * 10;
      ctx.fillStyle = `rgba(80,207,255,${pointAlpha.toFixed(3)})`;
      ctx.arc(CX, CY, 2.0 + pointIn * 2.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  let lastThinkingFrame = 0;

  function drawThinkingState(time) {
    const tSec = time * 0.001;
    const outerR = Math.min(W, H) * 0.26;
    const coreR = Math.min(W, H) * 0.055;

    const bg = ctx.createRadialGradient(CX, CY, coreR * 0.5, CX, CY, outerR * 1.05);
    bg.addColorStop(0, 'rgba(8,108,255,0.05)');
    bg.addColorStop(0.55, 'rgba(8,108,255,0.035)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(CX, CY, outerR * 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Continuous time-based movement: no discrete target switches.
    // Motion is intentionally slower and phase-continuous.
    const motionT = tSec * 0.62;

    const nodes = thinkingNodes.map((n, idx) => {
      const driftA = n.pulse + motionT * (0.48 + n.speed * 0.34);
      const driftB = n.pulse * 0.73 - motionT * (0.34 + n.drift * 0.55);

      const x = CX + n.x0 * outerR
        + Math.cos(driftA) * 6.8
        + Math.sin(driftB) * 3.8
        + Math.sin(motionT * 0.31 + n.pulse * 1.7) * 1.6;

      const y = CY + n.y0 * outerR
        + Math.sin(driftA * 0.92) * 5.9
        + Math.cos(driftB * 1.08) * 3.5
        + Math.cos(motionT * 0.27 + n.pulse * 1.2) * 1.4;

      const dx = x - CX, dy = y - CY;
      const rr = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const rNorm = clamp(rr / outerR, 0, 1.4);

      // Variable flicker speeds: some nodes breathe slowly, some react faster,
      // while the overall orbit / movement cycle stays the same.
      const slowRate = 0.65 + n.speed * 0.35;
      const midRate  = 1.55 + n.drift * 2.40 + (idx % 5) * 0.08;
      const fastRate = 3.20 + n.spark * 4.20 + (idx % 7) * 0.12;
      const burstRate = 1.10 + n.speed * 0.90 + (idx % 3) * 0.10;

      const tw1 = 0.5 + 0.5 * Math.sin(tSec * slowRate + n.pulse);
      const tw2 = 0.5 + 0.5 * Math.sin(tSec * midRate + idx * 0.6);
      const tw3 = 0.5 + 0.5 * Math.sin(tSec * fastRate + idx * 1.1);

      // Slow envelope makes some brightening phases linger longer,
      // so the transitions no longer feel uniformly fast.
      const envelope = 0.58 + 0.42 * (0.5 + 0.5 * Math.sin(tSec * (0.28 + n.spark * 0.18) + idx * 0.21));

      let flash = (tw1 * 0.34 + tw2 * 0.33 + tw3 * 0.33) * envelope;

      const spike = Math.max(0, Math.sin(tSec * burstRate + n.pulse * 3.0));
      const burstMix = 0.28 + 0.37 * (0.5 + 0.5 * Math.sin(tSec * (0.36 + n.drift * 0.22) + idx * 0.17));

      flash = clamp(flash * (0.82 + envelope * 0.18) + spike * burstMix, 0, 1.25);

      const broad1 = 0.5 + 0.5 * Math.sin(ang * 2.2 + tSec * 0.65);
      const broad2 = 0.5 + 0.5 * Math.sin(ang * 4.7 - tSec * 0.95 + rNorm * 2.8);
      const fragment = 0.5 + 0.5 * Math.sin(ang * 9.5 + rNorm * 8.0 - tSec * 1.25 + idx * 0.08);
      const patch = 0.5 + 0.5 * Math.sin((dx / outerR) * 5.8 - (dy / outerR) * 4.3 + tSec * 0.8);

      const solidMask = smoothstep(0.30, 0.70, broad1 * 0.62 + broad2 * 0.38);
      const brokenMask = smoothstep(0.46, 0.78, fragment * 0.55 + patch * 0.45);
      const mixMode = 0.5 + 0.5 * Math.sin(tSec * 0.55 + ang * 1.4);
      const structureMask = lerp(solidMask, solidMask * brokenMask, mixMode);
      const radialBias = 0.55 + 0.45 * Math.sin(tSec * 0.42 + rNorm * 5.0 - ang * 1.2);
      const presence = clamp(0.18 + structureMask * 0.82 * radialBias, 0.08, 1.0);

      flash *= presence;

      return {
        x, y, dx, dy, ang,
        flash,
        presence,
        size: n.size + flash * 1.9 + presence * 0.4,
        alpha: Math.min(1, 0.20 + flash * 1.02),
        rr
      };
    });

    // Batch links into a few intensity groups.
    // This preserves the look while avoiding hundreds of expensive individual shadow strokes.
    const linkBuckets = Array.from({length: 6}, () => []);
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const d = dist(a.x, a.y, b.x, b.y);
        if (d > 110) continue;

        const pairPresence = (a.presence + b.presence) * 0.5;
        const linkHot = Math.min(1, (a.flash + b.flash) * 0.55);

        // Soft distance fade removes visible popping when a connection enters/leaves range.
        const distanceFade = 1 - smoothstep(82, 110, d);
        const alpha = distanceFade * pairPresence * (0.032 + linkHot * 0.30);
        if (alpha < 0.008) continue;

        const q = clamp(alpha / 0.24, 0, 0.999);
        const bucket = Math.min(5, Math.floor(q * 6));
        linkBuckets[bucket].push([a.x, a.y, b.x, b.y]);
      }
    }

    for (let b = 0; b < linkBuckets.length; b++) {
      const segs = linkBuckets[b];
      if (!segs.length) continue;

      const q = (b + 0.5) / linkBuckets.length;

      // Glow layer without per-link shadowBlur: much smoother on mobile GPU.
      ctx.strokeStyle = `rgba(38,119,255,${(0.020 + q * 0.065).toFixed(3)})`;
      ctx.lineWidth = 1.15 + q * 1.10;
      ctx.beginPath();
      for (const s of segs) {
        ctx.moveTo(s[0], s[1]);
        ctx.lineTo(s[2], s[3]);
      }
      ctx.stroke();

      // Sharp luminous core.
      ctx.strokeStyle = `rgba(80,207,255,${(0.030 + q * 0.205).toFixed(3)})`;
      ctx.lineWidth = 0.38 + q * 0.68;
      ctx.beginPath();
      for (const s of segs) {
        ctx.moveTo(s[0], s[1]);
        ctx.lineTo(s[2], s[3]);
      }
      ctx.stroke();
    }

    nodes.forEach((n, idx) => {
      // Fade filaments in smoothly instead of switching them on abruptly.
      const filamentFade = smoothstep(0.12, 0.28, n.flash);
      if (filamentFade <= 0.01 || n.rr < coreR * 1.25) return;

      const filamentMode = 0.5 + 0.5 * Math.sin(tSec * 0.8 + n.ang * 2.4 + idx * 0.1);
      const toward = 0.08 + n.flash * (0.10 + filamentMode * 0.10);
      const tx = lerp(n.x, CX, toward);
      const ty = lerp(n.y, CY, toward);
      const alpha = (0.047 + n.flash * 0.24) * (0.55 + n.presence * 0.45) * filamentFade;

      const cpx = lerp(n.x, CX, 0.34) + Math.sin(idx * 0.5 + tSec) * (7 + 6 * filamentMode);
      const cpy = lerp(n.y, CY, 0.34) + Math.cos(idx * 0.4 - tSec * 1.2) * (7 + 6 * filamentMode);

      ctx.strokeStyle = `rgba(63,201,255,${alpha.toFixed(3)})`;
      ctx.lineWidth = 0.55 + n.flash * 0.70;
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.quadraticCurveTo(cpx, cpy, tx, ty);
      ctx.stroke();

      ctx.strokeStyle = `rgba(152,225,255,${(alpha * 0.42).toFixed(3)})`;
      ctx.lineWidth = 0.36 + n.flash * 0.28;
      ctx.beginPath();
      ctx.moveTo(n.x, n.y);
      ctx.quadraticCurveTo(cpx, cpy, tx, ty);
      ctx.stroke();
    });

    nodes.forEach(n => {
      if (n.alpha <= 0.02) return;
      ctx.beginPath();
      ctx.shadowColor = 'rgba(38,119,255,.98)';
      ctx.shadowBlur = 9 + n.flash * 19;
      ctx.fillStyle = `rgba(80,207,255,${n.alpha.toFixed(3)})`;
      ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.fillStyle = `rgba(190,239,255,${Math.min(0.96, n.alpha * 0.62).toFixed(3)})`;
      ctx.arc(n.x, n.y, Math.max(0.48, n.size * 0.42), 0, Math.PI * 2);
      ctx.fill();
    });

    for (let i = 0; i < 130; i++) {
      const a = i * 0.31 + Math.sin(i * 1.7) * 0.3;
      const r = (0.22 + (i % 37) / 37 * 0.86) * outerR;
      const x = CX + Math.cos(a + tSec * 0.03 * (i % 7)) * r;
      const y = CY + Math.sin(a + tSec * 0.025 * (i % 5)) * r * 0.92;
      const sector = 0.5 + 0.5 * Math.sin(a * 4.2 - tSec * 0.65);
      const al = (0.015 + ((i * 13) % 11) / 11 * 0.065) * (0.15 + sector * 0.85);
      if (al < 0.01) continue;
      ctx.fillStyle = `rgba(74,168,255,${al.toFixed(3)})`;
      ctx.fillRect(x, y, 1.2, 1.2);
    }

    const halo = ctx.createRadialGradient(CX, CY, coreR * 0.5, CX, CY, coreR * 2.2);
    halo.addColorStop(0, 'rgba(0,0,0,1)');
    halo.addColorStop(0.38, 'rgba(0,0,0,1)');
    halo.addColorStop(0.60, 'rgba(8,108,255,.18)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(CX, CY, coreR * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#000';
    ctx.arc(CX, CY, coreR, 0, Math.PI * 2);
    ctx.fill();
  }



  function drawStandbyState(time) {
    const tSec = time * 0.001;
    const rawComputed = [];

    // Standby should feel more compact, closer to the summon footprint.
    const standbyScale = 0.84;

    for (let iy = 0; iy < NY; iy++) {
      const row = [];
      for (let ix = 0; ix < NX; ix++) {
        const p = computeGridPoint(grid[iy][ix], tSec);
        row.push({
          ...p,
          x: CX + (p.x - CX) * standbyScale,
          y: CY + (p.y - CY) * standbyScale
        });
      }
      rawComputed.push(row);
    }
    const computed = smoothGridRows(rawComputed, 'standby', time, 6.6);

    // Coarser visible mesh for standby, so the point spacing feels closer
    // to summon / listening / responding even on the smaller footprint.
    function standbyVisible(ix, iy) {
      return (ix % 2 === 0 && iy % 2 === 0);
    }

    // Soft pseudo-random twinkling per visible node, without wave behavior.
    function twinkleAt(ix, iy) {
      const h1 = Math.sin(ix * 12.9898 + iy * 78.233) * 43758.5453;
      const h2 = Math.sin(ix * 41.1234 - iy * 23.771 + 1.618) * 24631.3141;
      const s1 = 0.5 + 0.5 * Math.sin(tSec * (0.55 + (Math.abs(h1) % 100) * 0.0018) + h1);
      const s2 = 0.5 + 0.5 * Math.sin(tSec * (0.92 + (Math.abs(h2) % 100) * 0.0024) + h2 * 0.7);
      const raw = s1 * 0.58 + s2 * 0.42;
      return smoothstep(0.62, 0.94, raw);
    }

    function drawLine(ax, ay, bx, by, alpha, width) {
      if (alpha < 0.003) return;
      ctx.strokeStyle = `rgba(80,207,255,${alpha.toFixed(3)})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    ctx.lineCap = 'round';

    // Compact faint mesh with softly blinking local links.
    for (let iy = 0; iy < NY; iy++) {
      for (let ix = 0; ix < NX; ix++) {
        if (!standbyVisible(ix, iy)) continue;
        const p = computed[iy][ix];
        const t0 = twinkleAt(ix, iy);

        if (ix + 2 < NX && standbyVisible(ix + 2, iy)) {
          const p2 = computed[iy][ix + 2];
          const t1 = twinkleAt(ix + 2, iy);
          const active = Math.max(0, (t0 + t1) * 0.5);
          const alpha = 0.014 + active * 0.067;
          drawLine(p.x, p.y, p2.x, p2.y, alpha, 0.86);
        }

        if (iy + 2 < NY && standbyVisible(ix, iy + 2)) {
          const p2 = computed[iy + 2][ix];
          const t1 = twinkleAt(ix, iy + 2);
          const active = Math.max(0, (t0 + t1) * 0.5);
          const alpha = 0.014 + active * 0.067;
          drawLine(p.x, p.y, p2.x, p2.y, alpha, 0.86);
        }

        if (ix + 2 < NX && iy + 2 < NY && standbyVisible(ix + 2, iy + 2) && (((ix + iy) / 2) % 2 === 0)) {
          const p2 = computed[iy + 2][ix + 2];
          const t1 = twinkleAt(ix + 2, iy + 2);
          const active = Math.max(0, (t0 + t1) * 0.5);
          const alpha = 0.004 + active * 0.026;
          drawLine(p.x, p.y, p2.x, p2.y, alpha, 0.64);
        }
      }
    }

    // Visible nodes only: fewer points, same standby logic.
    for (let iy = 0; iy < NY; iy++) {
      for (let ix = 0; ix < NX; ix++) {
        if (!standbyVisible(ix, iy)) continue;
        const p = computed[iy][ix];
        const tw = twinkleAt(ix, iy);
        const alpha = 0.075 + tw * 0.305;
        const r = 0.72 + p.centerPull * 0.92;

        ctx.beginPath();
        ctx.shadowColor = 'rgba(80,207,255,0.95)';
        ctx.shadowBlur = 4 + tw * 14;
        ctx.fillStyle = `rgba(80,207,255,${alpha.toFixed(3)})`;
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.fillStyle = `rgba(190,239,255,${(alpha * 0.62).toFixed(3)})`;
        ctx.arc(p.x, p.y, Math.max(0.40, r * 0.44), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Center point: the dot itself becomes smaller, then grows back,
    // while the surrounding glow expands with it.
    const pulse = 0.5 + 0.5 * Math.sin(tSec * 0.72);
    const coreR = ringR * (0.055 + pulse * 0.12);
    const haloR = ringR * (0.24 + pulse * 0.54);

    const sphereHalo = ctx.createRadialGradient(
      CX - coreR * 0.18, CY - coreR * 0.16, coreR * 0.06,
      CX, CY, haloR
    );
    sphereHalo.addColorStop(0, `rgba(205,245,255,${(0.68 + pulse * 0.12).toFixed(3)})`);
    sphereHalo.addColorStop(0.20, `rgba(95,195,255,${(0.36 + pulse * 0.14).toFixed(3)})`);
    sphereHalo.addColorStop(0.58, `rgba(8,108,255,${(0.10 + pulse * 0.10).toFixed(3)})`);
    sphereHalo.addColorStop(1, 'rgba(0,18,55,0)');
    ctx.fillStyle = sphereHalo;
    ctx.beginPath();
    ctx.arc(CX, CY, haloR, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.shadowColor = 'rgba(80,207,255,0.98)';
    ctx.shadowBlur = 8 + pulse * 18;
    ctx.fillStyle = `rgba(80,207,255,${(0.80 + pulse * 0.12).toFixed(3)})`;
    ctx.arc(CX, CY, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.fillStyle = `rgba(225,248,255,${(0.86 + pulse * 0.10).toFixed(3)})`;
    ctx.arc(CX, CY, Math.max(0.75, coreR * 0.42), 0, Math.PI * 2);
    ctx.fill();
  }


  // Bridge between the live listening/responding renderer and state seven.
  // Uses the SAME live mesh and its dark aperture, not a replacement grid.
  // The entire bridge is reversible because geometry depends only on progress.
  const bridgeEnd = .42;
  function drawVoiceDisappearBridge(time, progress) {
    const u = smoothstep(0, bridgeEnd, progress);
    const collapse = smoothstep(.10, 1, u);
    const scale = Math.max(.003, 1 - collapse * .997);
    const fade = 1 - smoothstep(.83, 1, u);
    root.style.backgroundColor='#00030a';
    ctx.save();
    ctx.translate(CX, CY);
    ctx.scale(scale, scale);
    ctx.translate(-CX, -CY);
    ctx.globalAlpha = fade;
    // Render the unchanged current state, including its real central hole.
    drawWebState(time);
    ctx.restore();
    // As the dark aperture becomes a point, retain a tiny blue pinprick.
    const pin = smoothstep(.76, .96, u) * (1 - smoothstep(.96, 1, u));
    if (pin > 0) {
      ctx.fillStyle = `rgba(80,207,255,${pin})`;
      ctx.shadowColor = '#26dcff';ctx.shadowBlur=14;
      ctx.beginPath();ctx.arc(CX,CY,1.6,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }
    workspace.style.opacity='0';
    workspace.style.clipPath='inset(50% 0 50% 0)';
    workspace.style.webkitClipPath=workspace.style.clipPath;
    root.classList.remove('is-workspace-visible');
    workspace.setAttribute('aria-hidden','true');
  }

  // Seventh state: one reversible timeline. The approved six state renderers remain unchanged.
  function drawTransition(time, skipVoiceMesh=false){
    const p=transitionProgress;
    // Non-uniform inward suction: particles bend into a funnel before flattening into a beam.
    const suction=smoothstep(0,.425,p);
    const flatten=smoothstep(.39,.54,p);
    const linePhase=smoothstep(.51,.70,p);
    const reveal=smoothstep(.67,1,p);
    root.style.backgroundColor=`rgba(0,3,10,${(1-reveal).toFixed(3)})`;
    // Preserve the existing listening/responding mesh at frame zero.
    // There is NO introductory growth from a point or from the hole rim.
    // The mesh contracts inward around its existing central dark aperture.
    // Reverse playback uses these exact same positions in reverse order.
    const fromVoiceHole = state === 'responding' || state === 'listening';
    const opacity=1-smoothstep(.405,.465,p);
    const sourceVoice = state === 'listening' ? voiceLevelListening(time * .001) : state === 'responding' ? voiceLevelResponding(time * .001) : .25;
    const sourceHoleRadius=ringR*(.58+sourceVoice*.06);
    // Feather the mesh in a radial/elliptical field: no visible rectangular outline.
    ctx.save();
    const nodes=[];
    for(let iy=0;iy<NY;iy++){
      const row=[];
      for(let ix=0;ix<NX;ix++){
        const base=computeGridPoint(grid[iy][ix],time*.001);
        const dx=base.x-CX,dy=base.y-CY;
        const radius=Math.hypot(dx,dy);
        const angle=Math.atan2(dy,dx);
        const rNorm=Math.min(1.5,radius/(Math.min(W,H)*.42));
        // Different radial shells are drawn inward at different rates, making
        // the actual mesh curve and twist rather than uniformly scale.
        const shellDelay=.20*Math.min(1,rNorm);
        const local=smoothstep(shellDelay, .91+shellDelay*.08, suction);
        const twist=(1-local)*local*(0.65+0.25*rNorm) + suction*.10*(1-rNorm);
        const bentAngle=angle+twist;
        const radialFactor=Math.pow(Math.max(.001,1-local),1.45);
        const funnel=1-.44*local*Math.exp(-Math.pow(rNorm-.45,2)*5);
        const radial=radius*radialFactor*funnel;
        // No artificial emergence: the starting geometry is the live grid.
        const emergedRadius=radial;
        let x=CX+Math.cos(bentAngle)*emergedRadius;
        let y=CY+Math.sin(bentAngle)*emergedRadius;
        // Last stage: the warped particle cloud compresses into a horizontal
        // luminous filament. Its remaining width also collapses toward center.
        const beamWidth=(1-flatten)*radial+flatten*Math.min(W*.48,radial*1.6);
        x=lerp(x,CX+Math.cos(bentAngle)*beamWidth,flatten);
        y=lerp(y,CY,flatten);
        row.push({x,y,base,rNorm,local});
      }
      nodes.push(row);
    }
    if(!skipVoiceMesh && p<.465){
      for(let iy=0;iy<NY;iy++){
        for(let ix=0;ix<NX;ix++){
          const q=nodes[iy][ix];
          // Uniform subtle breathing avoids travelling diagonal brightness bands.
          const shimmer=.92+.08*Math.sin(time*.0015);
          const radialEnvelope=1-smoothstep(.61,1.06,Math.hypot(grid[iy][ix].xx*.94,grid[iy][ix].yy*.94));
          const alpha=opacity*radialEnvelope*(.12+q.base.nodeAlpha*.85)*shimmer;
          ctx.strokeStyle=`rgba(74,168,255,${Math.max(0,alpha*.52)})`;
          ctx.lineWidth=.8;
          if(ix<NX-1){const r=nodes[iy][ix+1];const f=1-smoothstep(.61,1.06,Math.hypot(grid[iy][ix+1].xx*.94,grid[iy][ix+1].yy*.94));ctx.globalAlpha=f;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.stroke();ctx.globalAlpha=1;}
          if(iy<NY-1){const r=nodes[iy+1][ix];const f=1-smoothstep(.61,1.06,Math.hypot(grid[iy+1][ix].xx*.94,grid[iy+1][ix].yy*.94));ctx.globalAlpha=f;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.stroke();ctx.globalAlpha=1;}
          ctx.fillStyle=`rgba(80,207,255,${Math.min(1,alpha*2.5)})`;
          ctx.shadowColor='#086cff';ctx.shadowBlur=4+5*q.local;
          ctx.beginPath();ctx.arc(q.x,q.y,.7+q.base.centerPull*.9,0,Math.PI*2);ctx.fill();
        }
      }
    }
    ctx.shadowBlur=0;
    // The original dark hole stays visible while the existing mesh folds
    // around it; only THEN does the hole itself shrink to a luminous point.
    if(!skipVoiceMesh && fromVoiceHole && p<.465){
      const r=sourceHoleRadius*(1-smoothstep(.17,.425,p));
      const holeAlpha=1-smoothstep(.415,.465,p);
      ctx.save();ctx.globalAlpha=holeAlpha;
      ctx.fillStyle='#00030a';
      ctx.beginPath();ctx.arc(CX,CY,Math.max(.15,r),0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(38,220,255,.22)';ctx.lineWidth=.8;
      ctx.beginPath();ctx.arc(CX,CY,Math.max(.15,r),0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
    const coreVisibility=smoothstep(.435,.48,p)*(1-smoothstep(.53,.60,p));
    const burst=Math.exp(-Math.pow((p-.465)/.035,2));
    if(coreVisibility>0){
      const flashRadius=35+burst*76;
      const halo=ctx.createRadialGradient(CX,CY,0,CX,CY,flashRadius);
      halo.addColorStop(0,`rgba(152,225,255,${Math.min(1,coreVisibility*.9+burst*.8)})`);
      halo.addColorStop(.3,`rgba(8,108,255,${Math.min(1,coreVisibility*.36+burst*.42)})`);
      halo.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=halo;ctx.fillRect(CX-flashRadius,CY-flashRadius,flashRadius*2,flashRadius*2);
      ctx.shadowColor='#26dcff';ctx.shadowBlur=20+burst*42;ctx.fillStyle=`rgba(205,245,255,${Math.min(1,coreVisibility+burst*.8)})`;ctx.beginPath();ctx.arc(CX,CY,2.7+burst*4.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }
    const lineOpacity=smoothstep(.49,.60,p)*(1-smoothstep(.79,.99,p))*stateSevenBeamGate(p,transitionTarget);
    if(lineOpacity>0){
      const halfWidth=W*.56*linePhase;
      const grad=ctx.createLinearGradient(CX-halfWidth,CY,CX+halfWidth,CY);
      grad.addColorStop(0,'rgba(8,108,255,0)');grad.addColorStop(.5,`rgba(80,207,255,${lineOpacity})`);grad.addColorStop(1,'rgba(8,108,255,0)');
      ctx.strokeStyle=grad;ctx.lineWidth=1.7;ctx.shadowColor='#086cff';ctx.shadowBlur=15;ctx.beginPath();ctx.moveTo(CX-halfWidth,CY);ctx.lineTo(CX+halfWidth,CY);ctx.stroke();ctx.shadowBlur=0;
      // Horizontal source expands symmetrically upward and downward.
      const spread=H*.58*reveal;
      for(let i=0;i<13;i++){
        const f=(i+1)/13, y=spread*f;
        const alpha=lineOpacity*(1-f)*.28;
        ctx.strokeStyle=`rgba(8,108,255,${alpha})`;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(CX-halfWidth*(1-f*.15),CY-y);ctx.lineTo(CX+halfWidth*(1-f*.15),CY-y);ctx.moveTo(CX-halfWidth*(1-f*.15),CY+y);ctx.lineTo(CX+halfWidth*(1-f*.15),CY+y);ctx.stroke();
      }
    }
    ctx.restore();
    // The WORKSPACE ITSELF folds into the central horizontal slit.
    // On reverse playback: full page -> compressed horizontal slit -> point -> voice grid.
    // Clip the actual DOM page rather than merely fading it out.
    const open=stateSevenWorkspaceOpen(p);
    const halfHeight=50*open;
    workspace.style.clipPath=`inset(${(50-halfHeight).toFixed(3)}% 0 ${(50-halfHeight).toFixed(3)}% 0)`;
    workspace.style.webkitClipPath=workspace.style.clipPath;
    workspace.style.opacity=(p>.655?1:0).toString();
    workspace.style.transform=`scaleX(${(0.96+0.04*open).toFixed(4)})`;
    root.classList.toggle('is-workspace-visible',p>.995);
    workspace.setAttribute('aria-hidden',p>.995?'false':'true');
  }

  function tick(time){
    if (!running) return;
    updateAudioLevels(time);

    if (transitionActive || transitionProgress>0){
      if(!transitionLast)transitionLast=time;
      const dt=Math.min(60,time-transitionLast);transitionLast=time;
      const delta=dt/transitionDuration;
      transitionProgress=clamp(transitionProgress+Math.sign(transitionTarget-transitionProgress)*Math.min(delta,Math.abs(transitionTarget-transitionProgress)),0,1);
      ctx.clearRect(0,0,W,H);
      drawBackground();
      if (state==='listening'||state==='responding'||state==='disappearing') {
        if (transitionProgress <= bridgeEnd) {
          // The reverse from workspace restores the same original mesh,
          // and ends at the explicitly selected DISAPPEARING state.
          if(state==='disappearing') {
            const saved=state;state='responding';
            drawVoiceDisappearBridge(time,transitionProgress);
            state=saved;
          } else drawVoiceDisappearBridge(time, transitionProgress);
        } else {
          // The collapse was completed by the bridge. Seventh starts at flash.
          const actual=transitionProgress;
          transitionProgress=.435 + .565*((actual-bridgeEnd)/(1-bridgeEnd));
          drawTransition(time, true);
          transitionProgress=actual;
        }
      } else {
        drawTransition(time);
      }
      if(transitionProgress===transitionTarget){
        transitionActive=false;
        workspaceVisible=transitionProgress===1;
        if(workspaceVisible){
          root.classList.add('is-workspace-visible');
          document.body.classList.add('voice-workspace-visible');
          workspace.inert=false;
        } else {
          root.classList.remove('is-workspace-visible');
          document.body.classList.remove('voice-workspace-mode','voice-workspace-visible');
          workspace.style.opacity='0';
          workspace.style.clipPath='inset(50% 0 50% 0)';
          workspace.style.webkitClipPath=workspace.style.clipPath;
          workspace.style.removeProperty('transform');
          workspace.setAttribute('aria-hidden','true');
          workspace.inert=true;
          setState(stateBeforeWorkspace);
          root.style.backgroundColor='#00030a';
          stateSince=time-2000;
        }
        window.dispatchEvent(new CustomEvent('puls-voice-workspace-change',{detail:{open:workspaceVisible}}));
        if(workspaceVisible&&pendingTextExit){
          finishTextModeTransition();
          return;
        }
        if(!workspaceVisible&&pendingVoiceStart){
          pendingVoiceStart=false;
          void startVoiceSession();
        }
      }
      animationFrame=requestAnimationFrame(tick);return;
    }
    transitionLast=0;
    drawBackground();

    // Crossfade between actual live state renderers, not an abrupt jump.
    // Both states continue animating during the blend.
    const renderCurrent = () => {
      if (state === 'thinking') drawThinkingState(time);
      else if (state === 'standby') drawStandbyState(time);
      else drawWebState(time);
    };
    if (previousState !== null) {
      const b=smoothstep(0,1,(time-blendStarted)/blendDuration);
      // Standby -> Off: let the luminous particles and central dot fade away.
      // Never reveal the dark inner-hole mask of the generic disappearing renderer.
      if (previousState === 'standby' && state === 'disappearing') {
        const savedState=state, savedSince=stateSince;
        state='standby';stateSince=previousStateSince;
        ctx.save();ctx.globalAlpha=1-b;drawStandbyState(time);ctx.restore();
        state=savedState;stateSince=savedSince;
        if (b>=1) { previousState=null; stateSince=time-3000; }
        animationFrame=requestAnimationFrame(tick);return;
      }
      const savedState=state, savedSince=stateSince;
      state=previousState;stateSince=previousStateSince;
      ctx.save();ctx.globalAlpha=1-b;renderCurrent();ctx.restore();
      state=savedState;stateSince=savedSince;
      ctx.save();ctx.globalAlpha=b;renderCurrent();ctx.restore();
      if(b>=1) previousState=null;
    } else renderCurrent();

    animationFrame=requestAnimationFrame(tick);
  }

  function voiceLanguage(){
    try{return localStorage.getItem('puls_language_v1')||'en';}catch{return 'en';}
  }

  function voiceMessage(key){
    const ru=voiceLanguage().startsWith('ru');
    const messages={
      permission:ru?'Разрешите доступ к микрофону, чтобы использовать Voice Mode.':'Allow microphone access to use Voice Mode.',
      unsupported:ru?'Запись с микрофона не поддерживается этим браузером.':'Microphone recording is not supported by this browser.',
      recording:ru?'Не удалось записать голос. Попробуйте ещё раз.':'The voice recording failed. Please try again.',
      empty:ru?'Речь не распознана. Попробуйте ещё раз.':'No speech was recognized. Please try again.',
      failed:ru?'Голосовой запрос не выполнен. Попробуйте ещё раз.':'The voice request failed. Please try again.',
      playback:ru?'Не удалось воспроизвести голосовой ответ.':'The voice response could not be played.',
      navigationUnavailable:ru?'Не удалось открыть этот раздел.':'This section could not be opened.'
    };
    return messages[key]||messages.failed;
  }

  function showVoiceStatus(message,kind='error',{persistent=false}={}){
    clearTimeout(statusTimer);
    statusText.textContent=String(message||'');
    statusText.className=`puls-voice-status is-visible is-${kind}`;
    statusText.hidden=false;
    if(!persistent){
      statusTimer=setTimeout(()=>{
        statusText.classList.remove('is-visible');
        statusText.hidden=true;
      },3600);
    }
  }

  function clearVoiceStatus(){
    clearTimeout(statusTimer);statusTimer=0;
    statusText.classList.remove('is-visible');
    statusText.hidden=true;
    statusText.textContent='';
  }

  function notifyVoice(message){
    root.setAttribute('aria-label',`PULS Voice Mode. ${message}`);
    showVoiceStatus(message,'error');
  }

  function recorderMimeType(){
    if(typeof MediaRecorder==='undefined')return '';
    return ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus']
      .find(type=>MediaRecorder.isTypeSupported?.(type))||'';
  }

  function stopPlayback(){
    if(!currentPlayback)return;
    const element=currentPlayback;
    element.pause();
    element.dispatchEvent(new Event('ended'));
  }

  function releaseMicrophone(){
    cancelAnimationFrame(vadFrame);vadFrame=0;
    recorderLifecycle.cancel();
    microphoneSource?.disconnect();microphoneSource=null;
    microphoneAnalyser?.disconnect();microphoneAnalyser=null;
    microphoneSamples=null;
    if(microphoneContext){void microphoneContext.close().catch(()=>{});microphoneContext=null;}
    microphoneStream?.getTracks().forEach(track=>track.stop());microphoneStream=null;
    vadGate.reset();
    window.PULSVoiceVisual.setAudioLevel('listening',0);
  }

  function stopVoiceSession({standby=true}={}){
    voiceSessionEpoch++;
    voiceSessionActive=false;
    processingUtterance=false;
    releaseMicrophone();
    stopPlayback();
    clearVoiceStatus();
    if(standby&&active)setState('standby');
    updateToggleControl();
  }

  function settleVoiceListeningState(now=performance.now()){
    const idle=shouldEnterVoiceIdle({
      now,lastActivity:lastGenuineActivityAt,timeout:voiceInactivityMs,
      utteranceActive:vadGate.active,processing:processingUtterance
    });
    setState(idle?'standby':'listening');
  }

  function base64AudioUrl(audio){
    const type=String(audio?.content_type||'audio/mpeg');
    const data=String(audio?.data_base64||'');
    return data?`data:${type};base64,${data}`:'';
  }

  async function playAudioSource(source,epoch,{revoke=false}={}){
    if(!source)return false;
    const element=new Audio(source);
    currentPlayback=element;
    let visualConnected=false;
    setState('responding');
    try{
      try{
        window.PULSVoiceVisual.connectAudioElement?.(element);
        visualConnected=true;
      }catch{console.warn('PULS voice pipeline failure',{stage:'response_visualization'});}
      await element.play();
      await new Promise((resolve,reject)=>{
        element.addEventListener('ended',resolve,{once:true});
        element.addEventListener('error',()=>reject(new Error('PLAYBACK_FAILED')),{once:true});
      });
      return true;
    }finally{
      if(visualConnected)window.PULSVoiceVisual.disconnectAudioElement?.(element);
      if(currentPlayback===element)currentPlayback=null;
      element.removeAttribute('src');element.load();
      if(revoke)URL.revokeObjectURL(source);
      if(epoch===voiceSessionEpoch)window.PULSVoiceVisual.setAudioLevel('responding',0);
    }
  }

  function playVoiceResponse(audio,epoch){
    return playAudioSource(base64AudioUrl(audio),epoch);
  }

  async function requestNavigationAcknowledgement(navigation,turn){
    const form=new FormData();
    form.append('action',String(navigation?.action||''));
    form.append('language',turn.language||voiceLanguage());
    const response=await fetch(`${turn.apiBaseUrl}/api/voice/navigation-ack`,{
      method:'POST',headers:turn.headers,body:form,cache:'no-store'
    });
    if(!response.ok)throw new Error(`Navigation acknowledgement returned ${response.status}`);
    return (await response.json()).audio||null;
  }

  function navigationAssetAction(action){
    return action==='vehicle'?'my_vehicle':action;
  }

  async function cachedNavigationAcknowledgementSource(navigation,language){
    try{
      navigationAcknowledgementManifestPromise??=fetch(navigationAcknowledgementManifestUrl,{cache:'no-cache'})
        .then(response=>response.ok?response.json():null)
        .catch(()=>null);
      const manifest=await navigationAcknowledgementManifestPromise;
      const locale=String(language||'').toLowerCase().startsWith('ru')?'ru':'en';
      const action=navigationAssetAction(validatedVoiceNavigationAction(navigation?.action));
      const entry=action?manifest?.acknowledgements?.[locale]?.[action]:null;
      if(manifest?.voice!=='marin'||entry?.available!==true||!entry?.file)return null;
      const response=await fetch(`assets/audio/voice-acknowledgements/${encodeURIComponent(entry.file)}`,{cache:'force-cache'});
      if(!response.ok)return null;
      const blob=await response.blob();
      if(!blob.size)return null;
      return URL.createObjectURL(blob);
    }catch{return null;}
  }

  async function prepareNavigationAcknowledgement(navigation,turn,payloadAudio){
    if(silentNavigationActions.has(String(navigation?.action||'')))return null;
    const source=await cachedNavigationAcknowledgementSource(navigation,turn.language||voiceLanguage());
    if(source)return {source,revoke:true};
    const audio=payloadAudio||await requestNavigationAcknowledgement(navigation,turn);
    return audio?{audio}:null;
  }

  async function cachedGreetingSource(language){
    try{
      // Revalidate the tiny version manifest; the versioned MP3 itself remains
      // force-cached. A voice change is published as a new manifest URL.
      greetingManifestPromise??=fetch(greetingManifestUrl,{cache:'no-cache'})
        .then(response=>response.ok?response.json():null)
        .catch(()=>null);
      const manifest=await greetingManifestPromise;
      const entry=manifest?.available===true?manifest?.greetings?.[language]:null;
      if(!entry?.file||entry.text!==startupGreeting(language))return null;
      const response=await fetch(`assets/audio/voice-greetings/${encodeURIComponent(entry.file)}`,{cache:'force-cache'});
      if(!response.ok)return null;
      const blob=await response.blob();
      if(!blob.size)return null;
      console.info('PULS voice pipeline',{stage:'greeting_cache',assetVersion:manifest.asset_version,voice:manifest.voice});
      return URL.createObjectURL(blob);
    }catch{return null;}
  }

  async function playStartupGreeting(epoch){
    if(startupGreetingPlayed)return;
    startupGreetingPlayed=true;
    const language=voiceLanguage().startsWith('ru')?'ru':'en';
    try{
      const cachedSource=await cachedGreetingSource(language);
      if(cachedSource){
        if(epoch===voiceSessionEpoch&&active&&voiceSessionActive){
          await playAudioSource(cachedSource,epoch,{revoke:true});
        }else URL.revokeObjectURL(cachedSource);
      }else console.warn('PULS voice pipeline failure',{stage:'greeting_cache_missing'});
    }catch(error){
      // Cached greeting playback is an enhancement: listening must remain
      // available when the static asset or browser playback is unavailable.
      console.warn('PULS voice pipeline failure',{stage:'greeting',name:String(error?.name||'Error')});
    }
  }

  async function submitUtterance(blob,epoch,{finalized=false}={}){
    if(!voiceSessionActive||epoch!==voiceSessionEpoch||(processingUtterance&&!finalized))return;
    if(blob.size<512){
      processingUtterance=false;
      vadGate.reset();settleVoiceListeningState();
      return;
    }
    processingUtterance=true;
    setState('thinking');
    const diagnostics={stage:'submit',mimeType:blob.type||'audio/webm',audioBytes:blob.size};
    console.info('PULS voice pipeline',diagnostics);
    try{
      const bridge=window.PulsVoiceBridge;
      if(!bridge)throw new Error('VOICE_BRIDGE_UNAVAILABLE');
      const turn=await bridge.prepareTurn();
      const form=new FormData();
      form.append('audio',blob,blob.type.includes('ogg')?'utterance.ogg':'utterance.webm');
      form.append('language',turn.language||voiceLanguage());
      form.append('speak_response','true');
      for(const field of ['conversation_id','vehicle_id','problem_id','vehicle_selection_explicit']){
        const value=turn.context?.[field];
        if(value!==undefined&&value!==null&&value!=='')form.append(field,String(value));
      }
      const response=await fetch(`${turn.apiBaseUrl}/api/voice/turn`,{
        method:'POST',headers:turn.headers,body:form,cache:'no-store'
      });
      const payload=await response.json().catch(()=>({}));
      const providerRequestId=payload?.transcription?.request_id||null;
      console.info('PULS voice pipeline',{stage:'response',mimeType:diagnostics.mimeType,audioBytes:diagnostics.audioBytes,httpStatus:response.status,providerRequestId});
      if(!response.ok){
        const error=new Error(payload.detail||`Voice API returned ${response.status}`);
        error.status=response.status;throw error;
      }
      if(epoch!==voiceSessionEpoch||!active||!voiceSessionActive)return;
      lastGenuineActivityAt=performance.now();
      if(payload.navigation){
        await coordinateVoiceNavigation(payload.navigation,{
          dispatch:dispatchVoiceNavigation,
          prepareAudio:async()=>{
            try{return await prepareNavigationAcknowledgement(payload.navigation,turn,payload.audio);}
            catch{
              console.warn('PULS voice pipeline failure',{stage:'navigation_acknowledgement'});
              notifyVoice(voiceMessage('playback'));
              return null;
            }
          },
          playAudio:prepared=>{
            if(epoch!==voiceSessionEpoch||!active||!voiceSessionActive)return false;
            const playback=prepared?.source
              ?playAudioSource(prepared.source,epoch,{revoke:prepared.revoke===true})
              :playVoiceResponse(prepared?.audio,epoch);
            return playback.catch(()=>{
              console.warn('PULS voice pipeline failure',{stage:'navigation_playback'});
              notifyVoice(voiceMessage('playback'));
            });
          }
        });
        return;
      }
      await bridge.completeTurn(payload,turn.owner);
      if(epoch!==voiceSessionEpoch||!active||!voiceSessionActive)return;
      if(payload.audio){
        try{await playVoiceResponse(payload.audio,epoch);}
        catch{console.warn('PULS voice pipeline failure',{stage:'playback'});notifyVoice(voiceMessage('playback'));}
      }else if(payload.tts_error){
        notifyVoice(payload.tts_error);
      }
    }catch(error){
      console.warn('PULS voice pipeline failure',{stage:'request',mimeType:diagnostics.mimeType,audioBytes:diagnostics.audioBytes,httpStatus:Number(error?.status)||null,providerRequestId:null});
      if(error?.status===422)console.info('PULS voice pipeline',{stage:'no_speech',httpStatus:422});
      else notifyVoice(voiceMessage('failed'));
    }finally{
      if(epoch===voiceSessionEpoch&&active&&voiceSessionActive){
        processingUtterance=false;vadGate.reset();settleVoiceListeningState();
      }
    }
  }

  function monitorVoiceActivity(epoch,mimeType){
    if(epoch!==voiceSessionEpoch||!voiceSessionActive||!microphoneAnalyser||!microphoneSamples)return;
    microphoneAnalyser.getByteTimeDomainData(microphoneSamples);
    let power=0;
    for(const byte of microphoneSamples){const sample=(byte-128)/128;power+=sample*sample;}
    const rms=Math.sqrt(power/microphoneSamples.length);
    window.PULSVoiceVisual.setAudioLevel('listening',Math.max(0,Math.min(1,(rms-.008)*9)));
    if(!processingUtterance){
      const now=performance.now();
      const decision=vadGate.sample(rms,now);
      if(decision==='start'){
        // Starting on the first VAD-positive frame preserves a complete WebM
        // container. It may omit at most the onset before that analyser frame;
        // slicing an earlier recorder would reintroduce headerless WebM data.
        if(state==='standby')setState('listening');
        if(!recorderLifecycle.start(microphoneStream,mimeType,{epoch}))vadGate.reset();
      }else if(decision==='end'){
        processingUtterance=true;
        if(!recorderLifecycle.stop()){
          processingUtterance=false;vadGate.reset();settleVoiceListeningState(now);
        }
      }else if(shouldEnterVoiceIdle({now,lastActivity:lastGenuineActivityAt,timeout:voiceInactivityMs,utteranceActive:vadGate.active,processing:false})&&state!=='standby')setState('standby');
    }
    vadFrame=requestAnimationFrame(()=>monitorVoiceActivity(epoch,mimeType));
  }

  async function startVoiceSession(){
    if(voiceSessionActive)return;
    if(!window.pulsCurrentUser?.id){
      closeToText();
      window.openAuthModal?.();
      return;
    }
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
      notifyVoice(voiceMessage('unsupported'));setState('standby');return;
    }
    const epoch=++voiceSessionEpoch;
    voiceSessionActive=true;processingUtterance=false;updateToggleControl();
    try{
      microphoneStream=await navigator.mediaDevices.getUserMedia({
        audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false
      });
      if(epoch!==voiceSessionEpoch||!active||!voiceSessionActive){releaseMicrophone();return;}
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      microphoneContext=new AudioContextClass();
      microphoneSource=microphoneContext.createMediaStreamSource(microphoneStream);
      microphoneAnalyser=microphoneContext.createAnalyser();
      microphoneAnalyser.fftSize=2048;
      microphoneSamples=new Uint8Array(microphoneAnalyser.fftSize);
      microphoneSource.connect(microphoneAnalyser);
      const mimeType=recorderMimeType();
      processingUtterance=true;
      await playStartupGreeting(epoch);
      if(epoch!==voiceSessionEpoch||!active||!voiceSessionActive)return;
      processingUtterance=false;vadGate.reset();
      lastGenuineActivityAt=performance.now();
      setState('listening');
      monitorVoiceActivity(epoch,mimeType);
    }catch(error){
      console.warn('PULS microphone start failed:',error);
      if(epoch===voiceSessionEpoch){
        notifyVoice(voiceMessage('permission'));
        stopVoiceSession({standby:true});
      }
    }
  }

  function updateToggleControl(){
    toggleButton.classList.toggle('is-running',voiceSessionActive);
    toggleButton.classList.toggle('is-active',voiceSessionActive);
    toggleButton.setAttribute('aria-pressed',String(voiceSessionActive));
    toggleButton.setAttribute('aria-label',voiceSessionActive?'Stop Voice Mode':'Play Voice Mode');
  }

  function setControlPending(button,pending){
    button.classList.toggle('is-pending',pending);
    button.toggleAttribute('disabled',pending);
    if(pending)button.setAttribute('aria-busy','true');
    else button.removeAttribute('aria-busy');
  }

  function revealControls(){
    if(!active)return;
    controls.classList.add('is-visible');
    clearTimeout(controlsTimer);
    controlsTimer=setTimeout(()=>controls.classList.remove('is-visible'),5000);
  }

  function resetWorkspaceSurface(){
    clearTimeout(workspaceTimer);
    transitionProgress=0;transitionTarget=0;transitionLast=0;transitionActive=false;
    workspaceVisible=false;
    root.classList.remove('is-workspace-visible');
    document.body.classList.remove('voice-workspace-mode','voice-workspace-visible');
    workspace.style.removeProperty('opacity');
    workspace.style.removeProperty('clip-path');
    workspace.style.removeProperty('-webkit-clip-path');
    workspace.style.removeProperty('transform');
    root.style.removeProperty('background-color');
    workspace.removeAttribute('aria-hidden');
    workspace.inert=false;
  }

  function finishTextModeTransition(){
    pendingTextExit=false;pendingVoiceStart=false;
    active=false;running=false;
    clearTimeout(controlsTimer);clearTimeout(workspaceTimer);
    cancelAnimationFrame(animationFrame);
    resetWorkspaceSurface();
    document.body.classList.remove('voice-mode-active');
    controls.classList.remove('is-visible');
    setControlPending(keyboardButton,false);
    root.hidden=true;
    root.setAttribute('aria-hidden','true');
    window.dispatchEvent(new CustomEvent('puls-voice-mode-change',{detail:{active:false,source:'keyboard'}}));
  }

  function open({source='unknown'}={}){
    if(active){
      revealControls();
      if(pendingTextExit)return;
      if(workspaceVisible&&!transitionActive)hideWorkspace();
      else if(!transitionActive&&!voiceSessionActive)void startVoiceSession();
      return;
    }
    active=true;
    voiceWorkspaceTarget='conversation';
    voiceWorkspaceHistory=[];
    startupGreetingPlayed=false;
    root.hidden=false;
    root.setAttribute('aria-hidden','false');
    root.dataset.source=source;
    root.style.backgroundColor='#00030a';
    document.body.classList.add('voice-mode-active','voice-workspace-mode');
    document.body.classList.remove('voice-workspace-visible');
    window.PulsModeSelection?.hide?.();
    workspace.inert=true;
    workspace.setAttribute('aria-hidden','false');
    workspace.style.opacity='1';
    workspace.style.clipPath='inset(0 0 0 0)';
    workspace.style.webkitClipPath=workspace.style.clipPath;
    workspace.style.transform='scaleX(1)';
    voiceSessionActive=false;
    updateToggleControl();
    controls.classList.remove('is-visible');
    resize();
    previousState=null;
    state='disappearing';
    stateBeforeWorkspace='summon';
    stateSince=performance.now();
    blendStarted=stateSince;
    lastSpatialSmoothFrame=0;
    running=true;
    workspaceVisible=true;
    pendingTextExit=false;
    pendingVoiceStart=true;
    transitionProgress=1;transitionTarget=0;transitionLast=0;transitionActive=true;
    root.classList.add('is-workspace-visible');
    cancelAnimationFrame(animationFrame);
    animationFrame=requestAnimationFrame(tick);
    window.dispatchEvent(new CustomEvent('puls-voice-mode-change',{detail:{active:true,source}}));
  }

  function closeToText(){
    if(!active||pendingTextExit)return;
    stopVoiceSession({standby:false});
    pendingVoiceStart=false;
    if(workspaceVisible&&!transitionActive){
      finishTextModeTransition();
      window.PulsWorkspace?.show?.({view:'assistant'});
      return;
    }
    pendingTextExit=true;
    void showWorkspace({view:'assistant'});
  }

  function waitForWorkspaceState(open){
    if(workspaceVisible===open&&!transitionActive)return Promise.resolve(true);
    return new Promise(resolve=>{
      const handle=event=>{
        if(Boolean(event.detail?.open)!==open)return;
        window.removeEventListener('puls-voice-workspace-change',handle);
        resolve(true);
      };
      window.addEventListener('puls-voice-workspace-change',handle);
    });
  }

  function waitForTextModeExit(){
    if(!active)return Promise.resolve(true);
    return new Promise(resolve=>{
      const handle=event=>{
        if(event.detail?.active!==false)return;
        window.removeEventListener('puls-voice-mode-change',handle);
        resolve(true);
      };
      window.addEventListener('puls-voice-mode-change',handle);
    });
  }

  function performVoiceScroll(action){
    if(!workspaceVisible||transitionActive)return false;
    const target=voiceScrollTarget({
      assistantMode:document.body.classList.contains('assistant-mode'),
      messages:document.getElementById('messages'),
      mainPanel:document.querySelector('.content > .main-panel'),
      scrollingElement:document.scrollingElement
    });
    if(!target||typeof target.scrollTo!=='function')return false;
    target.scrollTo({top:voiceScrollTop(action,target),behavior:'smooth'});
    return true;
  }

  async function showWorkspace(target={view:'assistant'}){
    if(!active)open({source:'workspace'});
    if(workspaceVisible&&!transitionActive){
      await Promise.resolve(window.PulsWorkspace?.show?.(target));
      workspace.inert=false;
      document.body.classList.add('voice-workspace-mode','voice-workspace-visible');
      return true;
    }
    clearTimeout(workspaceTimer);
    document.body.classList.add('voice-workspace-mode');
    workspace.inert=true;
    stateBeforeWorkspace=state==='disappearing'?'standby':state;
    setState('disappearing');
    const workspaceReady=waitForWorkspaceState(true);
    // The approved DISAPPEARING state owns the collapse. State 7 begins at
    // its flash bridge, so the collapse is never duplicated.
    workspaceTimer=setTimeout(()=>{
      if(!active)return;
      transitionProgress=bridgeEnd;
      transitionTarget=1;
      transitionLast=0;
      transitionActive=true;
    },3000);
    await workspaceReady;
    await Promise.resolve(window.PulsWorkspace?.show?.(target));
    return true;
  }

  function dispatchVoiceNavigation(navigation){
    const action=validatedVoiceNavigationAction(navigation?.action);
    if(!action){
      notifyVoice(voiceMessage('navigationUnavailable'));
      return {started:false,completion:Promise.resolve(false)};
    }
    if(navigation?.available===false){
      notifyVoice(navigation.failure_message||voiceMessage('navigationUnavailable'));
      return {started:false,completion:Promise.resolve(false)};
    }
    if(action.startsWith('scroll_')){
      const started=performVoiceScroll(action);
      if(!started)notifyVoice(voiceMessage('navigationUnavailable'));
      return {started,completion:Promise.resolve(started)};
    }
    if(action==='text_interface'){
      const completion=waitForTextModeExit();
      closeToText();
      return {started:true,completion};
    }
    if(action==='voice_interface'){
      if(!workspaceVisible||transitionActive)return {started:true,completion:Promise.resolve(true)};
      const voiceReady=waitForWorkspaceState(false);
      hideWorkspace();
      return {started:true,completion:voiceReady};
    }
    const plan=voiceNavigationPlan(action,voiceWorkspaceTarget,voiceWorkspaceHistory);
    if(!plan.target){
      notifyVoice(voiceMessage('navigationUnavailable'));
      return {started:false,completion:Promise.resolve(false)};
    }
    const completion=showWorkspace(plan.target).then(()=>{
      voiceWorkspaceTarget=plan.current;
      voiceWorkspaceHistory=plan.history;
      return true;
    }).catch(error=>{
      console.warn('PULS voice pipeline failure',{stage:'navigation',action:String(navigation?.action||'')});
      notifyVoice(voiceMessage('navigationUnavailable'));
      return false;
    });
    return {started:true,completion};
  }

  function hideWorkspace(){
    if(!active||(!workspaceVisible&&!transitionActive))return;
    clearTimeout(workspaceTimer);
    transitionTarget=0;transitionLast=0;transitionActive=true;
  }

  root.addEventListener('pointerdown',revealControls);
  document.addEventListener('pointerdown',()=>{if(active&&workspaceVisible)revealControls();},{passive:true});
  controls.addEventListener('pointerdown',event=>event.stopPropagation());
  attachButton.addEventListener('click',()=>{
    if(attachButton.classList.contains('is-pending'))return;
    revealControls();setControlPending(attachButton,true);
    const input=document.getElementById('chatAttachmentInput');
    let settled=false;
    const settleOnFocus=()=>requestAnimationFrame(settle);
    const settle=()=>{
      if(settled)return;
      settled=true;setControlPending(attachButton,false);
      input?.removeEventListener('change',settle);
      window.removeEventListener('focus',settleOnFocus);
    };
    input?.addEventListener('change',settle,{once:true});
    window.addEventListener('focus',settleOnFocus,{once:true});
    try{window.PulsAttachments?.choose?.();}catch{settle();}
  });
  toggleButton.addEventListener('click',async()=>{
    if(toggleButton.classList.contains('is-pending'))return;
    revealControls();setControlPending(toggleButton,true);
    try{
      if(voiceSessionActive)stopVoiceSession({standby:true});
      else await startVoiceSession();
      window.dispatchEvent(new CustomEvent('puls-voice-session-toggle',{detail:{active:voiceSessionActive}}));
    }finally{setControlPending(toggleButton,false);updateToggleControl();}
  });
  keyboardButton.addEventListener('click',()=>{
    if(keyboardButton.classList.contains('is-pending'))return;
    setControlPending(keyboardButton,true);closeToText();
  });
  window.addEventListener('puls-mode-selected',event=>{if(event.detail?.mode==='voice')open({source:'mode-selection'});});

  window.PulsVoiceMode={open,closeToText,showWorkspace,hideWorkspace,setState,isActive:()=>active,isWorkspaceVisible:()=>workspaceVisible};
  window.PULSVoiceVisual.setState=setState;
  root.hidden=true;
  root.setAttribute('aria-hidden','true');
})();
