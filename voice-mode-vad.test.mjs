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
assert.match(voiceStyleSource,/data-voice-state="speaking"\][\s\S]*?var\(--puls-mode-input\)/,"voice response playback state is blue");
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
assert.match(appSource,/PulsDictation\s*=\s*\{[\s\S]*?toggle:\s*startDictation/);
assert.match(appSource,/input\.value \+= `\$\{prefix\}\$\{text\}`/,"dictation inserts editable text without submitting");
assert.match(indexSource,/puls-dictation-waveform[\s\S]*?puls-dictation-bars[\s\S]*?puls-dictation-transcribing[\s\S]*?data-dictation-state="idle"[\s\S]*?voice-btn-mic[\s\S]*?voice-btn-stop/,"dictation waveform and transcription label stay separate from the fixed microphone/stop control");
assert.match(indexSource,/voice-btn-mic[\s\S]*?<rect[\s\S]*?<path/,"idle dictation uses the approved outline SVG microphone");
assert.match(styleSource,/\.puls-dictation-bars i\s*\{[^}]*width:\s*1px[^}]*background:\s*#f7fbff/s,"recording waveform uses thin white bars");
assert.match(styleSource,/\.puls-dictation-waveform::before[\s\S]*?rgba\(247, 251, 255, \.86\) 0 1\.7px[\s\S]*?puls-dictation-dots 2\.7s linear infinite/,"larger white recording dots move continuously at half the prior speed");
assert.match(styleSource,/@keyframes puls-dictation-dots[\s\S]*?background-position:\s*-12px center/,"recording dots travel right to left without state-dependent restarts");
assert.match(styleSource,/transform:\s*scaleY\(var\(--dictation-scale\)\)/,"waveform amplitude is driven by compatible scale variables");
assert.match(styleSource,/\.voice-btn\[data-dictation-state="recording"\] \.voice-btn-stop,[\s\S]*?background:\s*#f7fbff/,"recording exposes a white stop square");
assert.match(styleSource,/\.puls-dictation-waveform\s*\{[^}]*left:\s*52px[^}]*right:\s*96px[^}]*width:\s*min\(56%, 360px\)/s,"desktop waveform is centered within the input region");
assert.match(styleSource,/@media \(max-width: 480px\)[\s\S]*?\.puls-dictation-waveform\s*\{[^}]*width:\s*auto[^}]*transform-origin:\s*right center/s,"mobile waveform fills the input region from the stop side");
assert.match(styleSource,/\.voice-btn\.is-dictation-pressed::after[\s\S]*?puls-dictation-press \.2s/,"microphone and stop presses use the brief blue halo");
assert.match(appSource,/setDictationVisualState\("recording"\)/,"dictation exposes recording state after recorder start");
assert.match(appSource,/setDictationVisualState\("transcribing"\)/,"dictation exposes transcription state while the existing request is pending");
assert.match(appSource,/createMediaStreamSource\(session\.stream\)/,"dictation analysis reuses the existing recording stream");
assert.match(appSource,/analysis\.peak = Math\.max\(\.12, input, analysis\.peak \* \.992\)/,"microphone amplitude uses smooth peak normalization and decay");
assert.match(appSource,/analysis\.history\.shift\(\)[\s\S]*?analysis\.history\.push\(analysis\.level < \.025 \? 0 : analysis\.level\)/,"each new microphone sample enters on the right while prior samples shift left");
assert.match(appSource,/now - analysis\.lastSampleAt >= 104/,"captured waveform history scrolls exactly twice as slowly");
assert.match(appSource,/renderDictationWaveform\(waveform, analysis\.history\)/,"one authoritative renderer draws the captured amplitude history");
assert.match(styleSource,/\.composer:has\(\.composer-shell\[data-dictation-state="recording"\]\)[\s\S]*?inset 0 0 16px rgba\(8, 125, 255, \.2\)/,"recording adds only the composer perimeter's blue inset glow");
assert.doesNotMatch(styleSource,/dictation-reveal|puls-dictation-fallback/,"obsolete reveal masks and synchronized fallback waves are removed");
assert.match(appSource,/getLanguage\(\) === "ru" \? "Расшифровка…" : "Transcribing…"/,"pending transcription uses the selected interface language");
assert.match(styleSource,/data-dictation-state="transcribing"\] \.puls-dictation-transcribing\s*\{[^}]*opacity:\s*1[^}]*visibility:\s*visible/s,"the subtle transcription label replaces the fading waveform while STT is pending");
assert.match(indexSource,/<path d="M7 3\.5h14q3 0 3 3v7q0 3-3 3H11l-4\.6 2\.75Q5 20\.1 5 18\.4v-2\.05q-1-\.3-1-1\.85v-8q0-3 3-3z"/,"the authoritative Text Mode SVG path contains visibly rounded bubble corners and tail transitions");
assert.doesNotMatch(voiceStyleSource,/\.puls-text-header-icon svg\s*\{[^}]*stroke-linejoin:\s*round/s,"obsolete CSS-only corner override is removed");
assert.match(appSource,/stopDictationAnalysis\(session\)[\s\S]*?getTracks\?\.\(\)\.forEach/,"audio analysis is cleaned up with the existing microphone lifecycle");
assert.match(appSource,/pulseDictationControl\(\{ stopping: dictationButton\(\)\?\.dataset\.dictationState === "recording" \}\)/,"the existing dictation action acknowledges microphone and stop presses");
assert.match(appSource,/const text = await uploadDictation[\s\S]*?await awaitDictationStopAcknowledgement\(\)[\s\S]*?insertDictationText\(text\)/,"STT begins immediately while fast results preserve the stop acknowledgement");
assert.match(appSource,/if \(session\.completion\) return session\.done/,"the first Stop or Send completion action wins");
assert.match(appSource,/completion === "send"\) await sendPrompt\(true\)/,"dictation Send submits through the existing text-message lifecycle after STT");
assert.match(appSource,/if \(!text\)[\s\S]*?resolveDone\(false\)[\s\S]*?return/,"empty transcription cannot auto-send an existing draft");
assert.match(appSource,/if \(!dictationSubmit && window\.PulsDictation\?\.isRecording\?\.\(\)\)[\s\S]*?window\.PulsDictation\.send\(\)/,"the existing Send control completes active dictation");
assert.match(appSource,/dictationTranscriptionController\.abort\(\)/,"mode switching can cancel pending dictation transcription safely");
assert.match(appSource,/setTimeout\(\(\) => \{ void stopDictation\(\{ completion: "review" \}\); \}, 30000\)/,"automatic dictation stop retains the 30-second review path");
assert.match(styleSource,/@media \(max-width: 480px\)[\s\S]*?\.composer-actions \.voice-btn\s*\{[^}]*left:\s*3px/s,"mobile moves only the microphone/stop control slightly toward Send");
assert.match(indexSource,/id="sendBtn"[^>]*>➤<\/button>/,"the existing Send arrow graphic is preserved");
assert.match(appSource,/action === "voice"[\s\S]*?PulsDictation\?\.toggle/,"composer microphone starts dictation");
assert.doesNotMatch(appSource,/action === "voice"[\s\S]{0,100}PulsVoiceMode\?\.open/,"composer microphone must not enter Voice Mode");
assert.match(voiceSource,/await window\.PulsDictation\?\.cancel\?\.\(\)/,"Voice Mode takes exclusive microphone ownership");
assert.match(authSource,/puls_mode_selection_completed/);
assert.match(authSource,/puls_mode_selection_required/);
assert.match(authSource,/supabaseClient\.auth\.updateUser/);
assert.match(carSource,/data-car-data-section="\$\{esc\(key\)\}"/);
assert.match(carSource,/group\.open=true;[\s\S]*?group\.scrollIntoView/);

console.log("voice-mode VAD, recorder, error UI and greeting isolation checks passed");
