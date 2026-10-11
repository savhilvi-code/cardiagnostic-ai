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
const styleSource=readFileSync(new URL("./assets/css/style.css",import.meta.url),"utf8");
const greetingManifest=JSON.parse(readFileSync(new URL("./assets/audio/voice-greetings/manifest.v1.json",import.meta.url),"utf8"));
assert.match(voiceSource,/pulsVoiceStatus/);
assert.doesNotMatch(appSource,/showGreeting\s*\(/,"the fixed greeting must not enter the main message workspace");
assert.equal(greetingManifest.available,true,"the two prerecorded greeting assets are active");
assert.equal(greetingManifest.voice,"marin");
assert.equal(greetingManifest.greetings.ru.text,window.PulsVoiceGreeting.text("ru"));
assert.equal(greetingManifest.greetings.en.text,window.PulsVoiceGreeting.text("en"));
assert.match(voiceSource,/greetingManifestUrl='assets\/audio\/voice-greetings\/manifest\.v1\.json'/);
assert.doesNotMatch(voiceSource,/showVoiceStatus\(startupGreeting/,"startup greeting must be audio-only");
assert.doesNotMatch(voiceSource,/\/api\/voice\/greeting/,"startup playback must not make repeated TTS requests");
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
assert.match(voiceSource,/processingUtterance=false;vadGate\.reset\(\);setState\('listening'\)/);

console.log("voice-mode VAD, recorder, error UI and greeting isolation checks passed");
