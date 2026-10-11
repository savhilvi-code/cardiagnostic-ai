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
assert.equal(greetingManifest.available,false,"paid greeting generation remains an explicit one-time action");
assert.equal(greetingManifest.greetings.ru.text,window.PulsVoiceGreeting.text("ru"));
assert.equal(greetingManifest.greetings.en.text,window.PulsVoiceGreeting.text("en"));
assert.match(voiceSource,/greetingManifestUrl='assets\/audio\/voice-greetings\/manifest\.v1\.json'/);
assert.match(voiceSource,/workspaceVisible&&pendingTextExit/);
assert.match(voiceSource,/!workspaceVisible&&pendingVoiceStart/);
assert.match(voiceSource,/transitionProgress=1;transitionTarget=0/);
assert.match(styleSource,/body\.assistant-mode\.chat-active \.messages\s*\{[^}]*padding-top:\s*var\(--puls-readable-top-inset\)/s);
assert.match(voiceSource,/setState\('thinking'\)/);
assert.match(voiceSource,/setState\('responding'\)/);
assert.match(voiceSource,/processingUtterance=false;vadGate\.reset\(\);setState\('listening'\)/);

console.log("voice-mode VAD, recorder, error UI and greeting isolation checks passed");
