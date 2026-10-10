import assert from "node:assert/strict";
import { createRequire } from "node:module";

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
  "Привет! Я Пульс, твой автомобильный помощник. Хочешь, расскажу, чем я могу тебе помочь?"
);
assert.equal(
  window.PulsVoiceGreeting.text("en"),
  "Hi! I'm PULS, your automotive assistant. Want me to tell you what I can help you with?"
);

console.log("voice-mode VAD focused checks passed");
