// headless Edge + CDP の小さな道具（Node 22+ の組み込み WebSocket / fetch だけ。追加の依存なし）
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const EDGE = process.env.EDGE_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port, width = 412, height = 900, mobile = true, args = [] } = {}) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), "edge-prof-bct-"));
  const proc = spawn(EDGE, [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`,
    "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    `--window-size=${width},${height}`, ...args, "about:blank",
  ], { stdio: "ignore" });
  let targets = [];
  for (let i = 0; i < 80; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      if (targets.some((t) => t.type === "page")) break;
    } catch { /* まだ起動中 */ }
    await sleep(250);
  }
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("Edge に つながりません（ポート " + port + "）");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id);
      pending.delete(d.id);
      d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result);
    } else if (d.method) listeners.forEach((fn) => fn(d));
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const on = (fn) => listeners.push(fn);
  const consoleLogs = [];
  on((d) => {
    if (d.method === "Runtime.consoleAPICalled") consoleLogs.push(d.params.type + ": " + d.params.args.map((a) => a.value ?? a.description).join(" "));
    if (d.method === "Runtime.exceptionThrown") consoleLogs.push("EXCEPTION: " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  });
  await send("Runtime.enable");
  await send("Page.enable");
  if (mobile) await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: true });
  const ev = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) + "\n  in: " + expr.slice(0, 120));
    return r.result.value;
  };
  const goto = async (url, wait = 1500) => {
    let loaded = false;
    const listener = (event) => { if (event.method === "Page.loadEventFired") loaded = true; };
    listeners.push(listener);
    try {
      const result = await send("Page.navigate", { url });
      if (result.errorText) throw new Error(`Navigation failed: ${result.errorText} (${url})`);
      const deadline = Date.now() + 20000;
      while (!loaded) {
        if (Date.now() > deadline) throw new Error(`Page load timed out: ${url}`);
        await sleep(50);
      }
      await sleep(wait);
    } finally {
      const index = listeners.indexOf(listener);
      if (index !== -1) listeners.splice(index, 1);
    }
  };
  const shot = async (file, clip) => {
    const r = await send("Page.captureScreenshot", clip ? { format: "png", clip } : { format: "png" });
    fs.writeFileSync(file, Buffer.from(r.data, "base64"));
  };
  const close = () => {
    try { ws.close(); } catch { /* なし */ }
    try { execSync(`taskkill /T /F /PID ${proc.pid}`, { stdio: "ignore" }); } catch { /* なし */ }
  };
  return { send, on, ev, goto, shot, close, consoleLogs, prof };
}
