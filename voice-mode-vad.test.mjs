import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

globalThis.window = {};
globalThis.document = { getElementById: () => null };
createRequire(import.meta.url)("./assets/js/voice-mode.js");

const gate = window.PulsVoiceVad.createVadGate();
assert.equal(gate.sample(0.008, 0), null);
assert.equal(gate.sample(0.05, 100), "start");
assert.equal(gate.sample(0.01, 700), null, "a short pause must not cut an utterance");
assert.equal(gate.sample(0.01, 1100), "end", "sustained silence completes the utterance");
assert.equal(gate.active, false);

gate.reset();
assert.equal(gate.sample(0.06, 2000), "start");
assert.equal(gate.sample(0.06, 32050), "end", "a bounded utterance prevents endless capture");

assert.equal(
  window.PulsVoiceGreeting.text("ru"),
  "Привет! Пульс на связи. Как твои дела?"
);
assert.equal(
  window.PulsVoiceGreeting.text("en"),
  "Hi! PULS here. How are you doing?"
);

const stateSeven=window.PulsVoiceStateSeven;
assert.equal(stateSeven.workspaceCollapseComplete,.66);
for(let progress=.67;progress<=1;progress+=.01){
  assert.ok(stateSeven.workspaceOpen(progress)>0);
  assert.equal(stateSeven.beamGate(progress,0),0,"Text → Voice beam must remain hidden while workspace is open");
}
assert.equal(stateSeven.workspaceOpen(.66),0);
assert.equal(stateSeven.beamGate(.66,0),0,"beam reveal starts only at collapse completion");
assert.ok(stateSeven.beamGate(.65,0)>0,"beam reveals immediately after collapse on the reverse timeline");
assert.equal(stateSeven.beamGate(.60,0),1);
assert.equal(stateSeven.beamGate(.80,1),1,"Voice → Text timing remains unchanged");

const idle=window.PulsVoiceIdle;
assert.equal(idle.shouldEnter({now:29999,lastActivity:0,timeout:30000}),false);
assert.equal(idle.shouldEnter({now:30000,lastActivity:0,timeout:30000}),true);
assert.equal(idle.shouldEnter({now:45000,lastActivity:0,timeout:30000,utteranceActive:true}),false);
assert.equal(idle.shouldEnter({now:45000,lastActivity:0,timeout:30000,processing:true}),false);

for(const [width,height] of [[375,812],[390,844],[768,1024],[1024,768],[1280,800],[1440,900],[1920,1080]]){
  const geometry=window.PulsVoiceLayout.geometry(width,height);
  assert.equal(geometry.cx,width/2,`${width}x${height} must remain horizontally centered`);
  assert.equal(geometry.cy,height*.47);
}

const navigation=window.PulsVoiceNavigation;
assert.equal(navigation.plan('workspace','conversation',[]).target,'conversation');
let navigationState=navigation.plan('vehicle','conversation',[]);
assert.equal(navigationState.target,'car');
assert.deepEqual(navigationState.history,['conversation']);
navigationState=navigation.plan('technical_data',navigationState.current,navigationState.history);
assert.equal(navigationState.target,'technicalData');
assert.deepEqual(navigationState.history,['conversation','car']);
navigationState=navigation.plan('back',navigationState.current,navigationState.history);
assert.equal(navigationState.target,'car');
assert.deepEqual(navigationState.history,['conversation']);
assert.equal(navigation.plan('unsupported','car',[]).target,null);
assert.equal(navigation.plan('my_vehicle','conversation',[]).target,'car');
assert.equal(navigation.validateAction('my_vehicle'),'my_vehicle');
assert.equal(navigation.validateAction('javascript:alert(1)'),null,"unknown model actions must be rejected");
for(const action of ['scroll_down','scroll_up','scroll_top','scroll_bottom','text_interface']){
  assert.equal(navigation.validateAction(action),action);
}

const voiceScroll=window.PulsVoiceScroll;
const chatScroll={scrollTop:120,clientHeight:500,scrollHeight:1800};
const pageScroll={scrollTop:80,clientHeight:700,scrollHeight:2400};
assert.equal(voiceScroll.target({assistantMode:true,messages:chatScroll,mainPanel:pageScroll}),chatScroll);
assert.equal(voiceScroll.target({assistantMode:false,messages:chatScroll,mainPanel:pageScroll}),pageScroll);
assert.equal(voiceScroll.top('scroll_down',chatScroll),550);
assert.equal(voiceScroll.top('scroll_up',chatScroll),0);
assert.equal(voiceScroll.top('scroll_top',pageScroll),0);
assert.equal(voiceScroll.top('scroll_bottom',pageScroll),1700);
assert.equal(voiceScroll.top('scroll_down',chatScroll),550,"speed must not alter step distance");
assert.equal(voiceScroll.adjustSpeed('normal','scroll_faster'),'fast');
assert.equal(voiceScroll.adjustSpeed('normal','scroll_slower'),'slow');
assert.ok(voiceScroll.durations.fast<voiceScroll.durations.normal);
assert.ok(voiceScroll.durations.normal<voiceScroll.durations.slow);

const turnOrder=window.PulsVoiceTurnOrder.create();
turnOrder.startSession('session-a');
const oldTurn=turnOrder.begin();
const currentTurn=turnOrder.begin();
assert.equal(turnOrder.isCurrent(oldTurn),false,"an older async turn cannot overwrite newer UI state");
assert.equal(turnOrder.isCurrent(currentTurn),true);
assert.equal(turnOrder.complete(currentTurn),true);
assert.equal(turnOrder.snapshot().lastCompletedTurn,currentTurn.id);
turnOrder.invalidate();
assert.equal(turnOrder.isCurrent(currentTurn),false,"terminated sessions reject pending results");

let finishTransition;
let finishAudio;
const navigationEvents=[];
const coordinated=navigation.coordinate({action:'workspace'}, {
  dispatch(){
    navigationEvents.push('dispatch');
    return {started:true,completion:new Promise(resolve=>{finishTransition=resolve;})};
  },
  prepareAudio(){
    navigationEvents.push('prepare-audio');
    return new Promise(resolve=>{finishAudio=resolve;});
  },
  playAudio(){navigationEvents.push('play-audio');return Promise.resolve(true);}
});
await Promise.resolve();
assert.deepEqual(navigationEvents,['dispatch','prepare-audio'],"UI dispatch and acknowledgement preparation must start together");
finishAudio({data_base64:'mock'});
await new Promise(resolve=>setTimeout(resolve,0));
assert.ok(navigationEvents.includes('play-audio'),"acknowledgement playback must not wait for State 7 completion");
finishTransition(true);
assert.equal(await coordinated,true);

class FakeRecorder {
  constructor(){this.mimeType="audio/webm;codecs=opus";this.state="inactive";this.listeners=new Map();}
  addEventListener(type,callback){this.listeners.set(type,callback);}
  emit(type,event={}){this.listeners.get(type)?.(event);}
  start(){this.state="recording";}
  stop(){
    this.state="inactive";
    this.emit("dataavailable",{data:new Blob([
      new Uint8Array([0x1a,0x45,0xdf,0xa3]),
      new Uint8Array([0x01,0x02,0x03])
    ],{type:this.mimeType})});
    this.emit("stop");
  }
}

const completed=[];
const lifecycle=window.PulsVoiceRecorder.createLifecycle({
  createRecorder:()=>new FakeRecorder(),
  onBlob:(blob,context)=>completed.push({blob,context})
});
assert.equal(lifecycle.start({},"audio/webm;codecs=opus",{epoch:7}),true);
assert.equal(lifecycle.start({},"audio/webm;codecs=opus",{epoch:8}),false,"overlapping recorders are rejected");
assert.equal(lifecycle.stop(),true);
assert.equal(completed.length,1,"one utterance produces one finalized submission");
assert.equal(completed[0].context.epoch,7);
assert.deepEqual(
  Array.from(new Uint8Array(await completed[0].blob.arrayBuffer()).slice(0,4)),
  [0x1a,0x45,0xdf,0xa3],
  "the independently recorded utterance retains its WebM EBML header"
);
assert.equal(lifecycle.stop(),false,"a finalized utterance cannot be submitted twice");

const canceled=[];
const canceledLifecycle=window.PulsVoiceRecorder.createLifecycle({
  createRecorder:()=>new FakeRecorder(),onBlob:blob=>canceled.push(blob)
});
assert.equal(canceledLifecycle.start({},"audio/webm",{}),true);
canceledLifecycle.cancel();
assert.equal(canceled.length,0,"cancellation discards stale audio");

const voiceSource=readFileSync(new URL("./assets/js/voice-mode.js",import.meta.url),"utf8");
const appSource=readFileSync(new URL("./assets/js/app.js",import.meta.url),"utf8");
const authSource=readFileSync(new URL("./assets/js/auth.js",import.meta.url),"utf8");
const modeSelectionSource=readFileSync(new URL("./assets/js/mode-selection.js",import.meta.url),"utf8");
const styleSource=readFileSync(new URL("./assets/css/style.css",import.meta.url),"utf8");
const voiceStyleSource=readFileSync(new URL("./assets/css/voice-mode.css",import.meta.url),"utf8");
const indexSource=readFileSync(new URL("./index.html",import.meta.url),"utf8");
const carSource=readFileSync(new URL("./assets/pages/car.js",import.meta.url),"utf8");
const greetingManifest=JSON.parse(readFileSync(new URL("./assets/audio/voice-greetings/manifest.v1.json",import.meta.url),"utf8"));
const navigationManifest=JSON.parse(readFileSync(new URL("./assets/audio/voice-acknowledgements/manifest.v1.json",import.meta.url),"utf8"));
assert.match(voiceSource,/pulsVoiceStatus/);
assert.doesNotMatch(appSource,/showGreeting\s*\(/,"the fixed greeting must not enter the main message workspace");
assert.equal(greetingManifest.available,true,"the two prerecorded greeting assets are active");
assert.equal(greetingManifest.voice,"marin");
assert.equal(greetingManifest.greetings.ru.text,window.PulsVoiceGreeting.text("ru"));
assert.equal(greetingManifest.greetings.en.text,window.PulsVoiceGreeting.text("en"));
assert.match(voiceSource,/greetingManifestUrl='assets\/audio\/voice-greetings\/manifest\.v1\.json'/);
assert.doesNotMatch(voiceSource,/showVoiceStatus\(startupGreeting/,"startup greeting must be audio-only");
assert.doesNotMatch(voiceSource,/\/api\/voice\/greeting/,"startup playback must not make repeated TTS requests");
assert.doesNotMatch(voiceSource,/status===422\?voiceMessage\('empty'\)/,"empty transcription must remain silent");
assert.match(voiceSource,/dataset\.inactivityMs\)\|\|30000/);
assert.match(voiceSource,/root\.clientWidth\|\|bounds\.width\|\|window\.innerWidth/);
assert.doesNotMatch(voiceSource,/visualCenter|viewportWidth/,"canvas coordinates must not mix visual and layout viewports");
assert.match(voiceSource,/is-pending/);
assert.match(voiceStyleSource,/\.puls-voice-control\.is-pending::before/);
assert.match(voiceStyleSource,/0 0 34px rgba\(8, 108, 255, \.28\)/);
assert.match(voiceStyleSource,/body\.voice-workspace-visible \.puls-voice-header-label/);
assert.match(voiceStyleSource,/grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\)/,"voice header uses symmetric side tracks for geometric centering");
assert.match(voiceStyleSource,/body\.voice-workspace-visible \.puls-voice-header-label\s*\{[^}]*position:\s*static/s);
assert.doesNotMatch(voiceStyleSource,/body\.voice-workspace-mode #app > \.topbar/,"existing header must remain available in Voice workspace");
assert.match(voiceSource,/if\(workspaceVisible&&!transitionActive\)/,"subsequent navigation must not replay State 7");
assert.match(voiceSource,/waitForWorkspaceState\(true\)/,"first navigation must wait for the existing State 7 reveal");
assert.match(voiceSource,/if\(payload\.navigation\)/,"frontend must consume the backend navigation response field");
assert.match(voiceSource,/dispatch:navigation=>dispatchVoiceNavigation\(navigation,voiceTurn\)/,"backend navigation must reach the ordered workspace dispatcher");
assert.match(voiceSource,/await workspaceReady;[\s\S]*?PulsWorkspace\?\.show\?\.\(target\)/,"first target must be applied after State 7 completes");
assert.match(voiceSource,/action==='voice_interface'[\s\S]*?waitForWorkspaceState\(false\)[\s\S]*?hideWorkspace\(\)/,"return-to-voice must use the existing reverse State 7 lifecycle");
assert.match(voiceSource,/const transitionDuration = 2400/,"approved State 7 duration must remain unchanged");
assert.match(voiceSource,/workspaceTimer=setTimeout\([\s\S]*?3000\)/,"approved State 7 start timing must remain unchanged");
assert.match(voiceSource,/if\(voiceSessionActive\)return/,"navigation must not create a duplicate microphone session");
assert.match(voiceSource,/headerIndicator\.dataset\.voiceState/);
assert.match(voiceStyleSource,/data-voice-state="thinking"[\s\S]*?var\(--puls-mode-processing\)/);
assert.match(voiceStyleSource,/data-voice-state="speaking"/);
assert.match(indexSource,/puls-voice-header-audiogram[\s\S]*puls-header-mode-label[\s\S]*puls-text-header-icon/,"header mode controls keep one fixed icon-label-icon order");
assert.match(voiceStyleSource,/\.puls-header-mode-label\s*\{[^}]*width:\s*74px/s,"mode label uses a compact fixed-width desktop slot");
assert.match(voiceStyleSource,/\.puls-header-mode-control,[\s\S]*?border:\s*0/s,"mode switch remains borderless");
assert.match(voiceStyleSource,/data-mode="text"\]\[data-text-state="idle"\][\s\S]*?var\(--puls-mode-idle\)/,"text idle state is white");
assert.match(voiceStyleSource,/data-mode="text"\]\[data-text-state="typing"\][\s\S]*?var\(--puls-mode-input\)/,"text input state is blue");
assert.match(voiceStyleSource,/data-mode="text"\]\[data-text-state="thinking"\][\s\S]*?var\(--puls-mode-processing\)/,"text processing reuses the active orange state");
assert.match(voiceStyleSource,/data-voice-state="listening"\][\s\S]*?var\(--puls-mode-input\)/,"voice input state is blue");
assert.match(voiceStyleSource,/data-voice-state="speaking"\][\s\S]*?var\(--puls-mode-processing\)/,"voice response state is orange");
assert.match(appSource,/textBusy \? "thinking" : this\.textInputActive \? "typing" : "idle"/,"text state priority is processing, input, idle");
assert.match(appSource,/setTextInput\(Boolean\(\$\("#promptInput"\)\?\.value\.trim\(\)\)\)/,"text input state follows composer content rather than focus");
assert.match(voiceSource,/const headerState=vadGate\.active\?'listening':'idle'/,"voice input color follows the existing VAD gate");
assert.match(authSource,/puls_mode_selection_completed/);
assert.doesNotMatch(authSource,/event !== "SIGNED_IN"/,"restored SIGNED_IN must not directly open onboarding");
assert.match(modeSelectionSource,/completePulsModeOnboarding/);
assert.match(appSource,/repairs:\s*\{ view: "car", tab: "history", filter: "repairs" \}/);
assert.match(voiceStyleSource,/@media \(max-width: 480px\)[\s\S]*?\.puls-voice-canvas\s*\{[\s\S]*?transform:\s*scale\(1\.05\)/);
for(const language of ["ru","en"]){
  const file=greetingManifest.greetings[language].file;
  const audio=new Uint8Array(readFileSync(new URL(`./assets/audio/voice-greetings/${file}`,import.meta.url)));
  assert.ok(audio.length>10000,`${language} greeting MP3 must be populated`);
  assert.equal(audio[0],0xff);
  assert.equal(audio[1]&0xe0,0xe0,`${language} greeting must begin with an MPEG audio frame`);
}
assert.match(voiceSource,/workspaceVisible&&pendingTextExit/);
assert.match(voiceSource,/!workspaceVisible&&pendingVoiceStart/);
assert.match(voiceSource,/transitionProgress=1;transitionTarget=0/);
assert.match(styleSource,/body\.assistant-mode\.chat-active \.messages\s*\{[^}]*padding-top:\s*var\(--puls-readable-top-inset\)/s);
assert.match(voiceSource,/setState\('thinking'\)/);
assert.match(voiceSource,/setState\('responding'\)/);
assert.match(voiceSource,/processingUtterance=false;vadGate\.reset\(\);settleVoiceListeningState\(\)/);
assert.doesNotMatch(voiceSource,/blob\.size<512[\s\S]{0,160}notifyVoice/,"local silence must not show a warning");
assert.equal(navigationManifest.voice,'marin');
assert.equal(navigationManifest.acknowledgements.ru.my_vehicle.text,'Открываю автомобиль.');
assert.equal(navigationManifest.acknowledgements.en.voice_interface.text,'Returning.');
assert.equal(navigationManifest.acknowledgements.ru.workspace.available,false,"missing paid assets must be declared unavailable");
assert.match(voiceSource,/entry\?\.available!==true\|\|!entry\?\.file/);
assert.match(voiceSource,/payloadAudio\|\|await requestNavigationAcknowledgement/,"missing cached assets must use runtime TTS fallback");
assert.match(voiceSource,/silentNavigationActions\.has\(String\(navigation\?\.action/,"scroll and text-mode actions must not request TTS");
assert.match(voiceSource,/action\.startsWith\('scroll_'\)[\s\S]*?performVoiceScroll/);
assert.match(voiceSource,/action==='text_interface'[\s\S]*?closeToText\(\)/,"text command must use the existing text-mode lifecycle");
assert.match(voiceSource,/function stopVoiceSession[\s\S]*?voiceSessionEpoch\+\+[\s\S]*?releaseMicrophone\(\)/,"text exit invalidates pending turns and releases the microphone");
assert.match(voiceSource,/if\(epoch!==voiceSessionEpoch\|\|!active\|\|!voiceSessionActive\)return;[\s\S]*?lastGenuineActivityAt/,"late voice responses must not reactivate UI after exit");
assert.match(voiceSource,/last_ui_action/);
assert.match(voiceSource,/voice_presentation/);
assert.match(voiceSource,/function cancelVoiceScroll\(\)[\s\S]*?cancelAnimationFrame/);
assert.match(voiceSource,/function resetVoiceScrollContext\(\)[\s\S]*?voiceScrollSpeed='normal'/);
assert.match(voiceSource,/plan\.current!==voiceWorkspaceTarget\)resetVoiceScrollContext\(\)/,"changing views must clear stale scroll context");
assert.match(voiceSource,/voiceTurnOrder\.startSession/);
assert.match(voiceSource,/voice_session_id/);
assert.match(voiceSource,/last_completed_voice_turn_id/);
assert.match(voiceSource,/showWorkspace\(plan\.target,\{isCurrent\}\)/,"State 7 completion must not apply an obsolete target");
assert.match(voiceSource,/voiceSessionActive&&voiceTurnOrder\.isCurrent\(voiceTurn\)/,"stale turn cleanup must not reactivate Listening");
assert.match(voiceSource,/technical_consumables:'technicalConsumables'/);
assert.match(appSource,/technicalConsumables:\s*\{ view: "car", tab: "data", section: "consumables" \}/);
assert.match(appSource,/technical_consumables:\s*\{ target: "technicalConsumables"/);
assert.match(appSource,/settings:\s*\{ target: "settings"/);
assert.match(appSource,/\/api\/voice\/transcribe/);
assert.match(appSource,/PulsDictation\s*=\s*\{ toggle: startDictation/);
assert.match(appSource,/input\.value \+= `\$\{prefix\}\$\{text\}`/,"dictation inserts editable text without submitting");
assert.match(indexSource,/data-dictation-state="idle"[\s\S]*?voice-btn-stop[\s\S]*?puls-dictation-audiogram/,"dictation control preserves a fixed slot for stop and audiogram states");
assert.match(styleSource,/data-dictation-state="recording"[\s\S]*?#43bfff/,"recording dictation uses blue feedback");
assert.match(styleSource,/data-dictation-state="transcribing"[\s\S]*?#ff9a32/,"transcribing dictation uses orange feedback");
assert.match(appSource,/setDictationVisualState\("recording"\)/,"dictation exposes recording state after recorder start");
assert.match(appSource,/setDictationVisualState\("transcribing"\)/,"dictation exposes transcription state while the existing request is pending");
assert.match(appSource,/dictationTranscriptionController\.abort\(\)/,"mode switching can cancel pending dictation transcription safely");
assert.match(appSource,/setTimeout\(\(\) => \{ void stopDictation\(\{ submit: true \}\); \}, 30000\)/,"automatic dictation stop retains the 30-second limit");
assert.match(appSource,/action === "voice"[\s\S]*?PulsDictation\?\.toggle/,"composer microphone starts dictation");
assert.doesNotMatch(appSource,/action === "voice"[\s\S]{0,100}PulsVoiceMode\?\.open/,"composer microphone must not enter Voice Mode");
assert.match(voiceSource,/await window\.PulsDictation\?\.cancel\?\.\(\)/,"Voice Mode takes exclusive microphone ownership");
assert.match(authSource,/puls_mode_selection_completed/);
assert.match(authSource,/puls_mode_selection_required/);
assert.match(authSource,/supabaseClient\.auth\.updateUser/);
assert.match(carSource,/data-car-data-section="\$\{esc\(key\)\}"/);
assert.match(carSource,/group\.open=true;[\s\S]*?group\.scrollIntoView/);

console.log("voice-mode VAD, recorder, error UI and greeting isolation checks passed");
