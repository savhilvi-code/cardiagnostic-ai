import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../assets/js/auth.js", import.meta.url), "utf8");

function loginContext(result) {
  const events = [];
  const modal = {
    classList: { contains: () => true, remove: (name) => events.push(`modal:${name}`) },
    setAttribute: (name, value) => events.push(`${name}:${value}`)
  };
  const status = { textContent: "", classList: { toggle() {} } };
  const password = { type: "password" };
  const passwordToggle = { setAttribute() {} };
  const elements = new Map([
    ["authModal", modal],
    ["authStatus", status],
    ["authPassword", password],
    ["authPasswordToggle", passwordToggle]
  ]);
  const document = {
    getElementById: (id) => elements.get(id) || null,
    querySelectorAll: () => [],
    addEventListener() {}
  };
  const window = {
    supabaseClient: { auth: { signInWithPassword: async () => result } },
    PulsI18n: {
      registry: { get: () => ({ name: "English", flag: "" }) },
      getLanguage: () => "en",
      loadProfileLanguage: async () => null,
      normalizeLanguage: (value) => value
    },
    PulsWorkspace: { show: async ({ view }) => events.push(`workspace:${view}`) },
    dispatchEvent: (event) => events.push(event.type),
    localStorage: { getItem: () => null, setItem() {} },
    addEventListener() {}
  };
  const context = vm.createContext({
    console,
    document,
    window,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    setTimeout
  });
  vm.runInContext(source, context, { filename: "assets/js/auth.js" });
  return { context, events, status };
}

test("successful login closes auth and opens the assistant workspace immediately", async () => {
  const user = { id: "user-1", email: "user@example.test", user_metadata: { puls_mode_selection_completed: true } };
  const { context, events } = loginContext({ data: { user }, error: null });

  await context.loginUser(user.email, "secret1");

  assert.ok(events.indexOf("puls-auth-change") < events.indexOf("modal:show"));
  assert.ok(events.indexOf("modal:show") < events.indexOf("workspace:assistant"));
});

test("failed login keeps the authorization modal open", async () => {
  const { context, events, status } = loginContext({ data: {}, error: { message: "Invalid credentials" } });

  await context.loginUser("user@example.test", "secret1");

  assert.equal(status.textContent, "Invalid credentials");
  assert.equal(events.includes("modal:show"), false);
  assert.equal(events.includes("workspace:assistant"), false);
});
