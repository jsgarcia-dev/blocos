// Captura uma página em 1180 × 700 no Google Chrome headless, em tempo real.
// Uso: node scripts/fidelidade/capturar.mjs <url> <saida.png>
//
// Espera a página carregar (fontes incluídas e, com "?demo=", o sinal data-demo-ready do app),
// leva as animações ao estado final (as infinitas, como o cursor piscando, ao quadro inicial)
// e captura. Não usa o modo de "tempo virtual" do Chrome: nele, a sombra grande do menu "/"
// faz o texto do menu ser desenhado em tons de cinza, o que não acontece no uso normal.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error("uso: node capturar.mjs <url> <saida.png>");
  process.exit(2);
}
const port = 9300 + Math.floor(Math.random() * 600);
const profile = mkdtempSync(join(tmpdir(), "blocos-captura-"));
const chrome = spawn(
  "google-chrome",
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1180,700",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (code) => {
  chrome.kill();
  setTimeout(() => {
    rmSync(profile, { recursive: true, force: true });
    process.exit(code);
  }, 300);
};

let ws;
for (let i = 0; i < 100 && !ws; i++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const page = targets.find((t) => t.type === "page");
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch {
    /* o Chrome ainda está abrindo */
  }
  if (!ws) await sleep(100);
}
if (!ws) {
  console.error("não consegui falar com o Chrome");
  done(1);
}
await new Promise((r) => ws.addEventListener("open", r));
let seq = 0;
const pending = new Map();
ws.addEventListener("message", (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) {
    pending.get(d.id)(d);
    pending.delete(d.id);
  }
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++seq;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.result?.value;

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1180, height: 700, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 1 } });
await send("Page.navigate", { url });

const ready = `document.readyState === "complete" && document.fonts.status === "loaded" &&
  (!location.search.includes("demo=") || document.documentElement.dataset.demoReady === "1")`;
let ok = false;
for (let i = 0; i < 300 && !ok; i++) {
  await sleep(100);
  ok = (await evaluate(ready)) === true;
}
if (!ok) {
  console.error("a página não ficou pronta em 30 s");
  done(1);
}
await sleep(1000);
await evaluate(`document.getAnimations().forEach((a) => {
  const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
  if (t && t.iterations === Infinity) { a.currentTime = 0; a.pause(); } else { a.finish(); }
})`);
await sleep(500);
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
ws.close();
done(0);
