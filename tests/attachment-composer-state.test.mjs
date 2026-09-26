import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../assets/js/app.js", import.meta.url), "utf8");

function productionFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in app.js`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const completeUpload = vm.runInNewContext(`(${productionFunction("completePendingAttachmentUpload")})`);
const canSendSource = productionFunction("chatComposerCanSend");

for (const [label, mimeType] of [["image", "image/jpeg"], ["PDF", "application/pdf"]]) {
  test(`${label} upload completion keeps the same pending attachment ready to send`, () => {
    const pending = {
      filename: `sample-${label}`,
      state: "uploading",
      messageId: "",
      fileId: "",
      file: { mime_type: mimeType },
    };
    const completed = completeUpload(pending, {
      message_id: `message-${label}`,
      file: { id: `file-${label}`, mime_type: mimeType },
    });

    assert.equal(completed, pending);
    assert.equal(pending.state, "ready");
    assert.equal(pending.messageId, `message-${label}`);
    assert.equal(pending.fileId, `file-${label}`);

    const canSend = vm.runInNewContext(
      `${canSendSource}; chatComposerCanSend()`,
      {
        pendingChatAttachment: pending,
        activeChatAttachmentUploads: 0,
        window: { PulsChat: { sending: false } },
        $: () => ({ value: "" }),
      },
    );
    assert.equal(canSend, true);
  });
}
