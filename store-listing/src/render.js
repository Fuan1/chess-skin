// Render the Chrome Web Store images from store-images.html.
// Drives headless Chrome over the DevTools protocol so each image gets an exact
// viewport size (the --screenshot flag's viewport is smaller than the window).
// Usage: node store-listing/src/render.js   (Node 22+, Chrome installed)
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
const PAGE = pathToFileURL(path.join(__dirname, "store-images.html")).href;
const OUT_DIR = path.join(__dirname, "..", "images");

const SHOTS = [
  ["hero", 1280, 800, "screenshot-1-hero.png"],
  ["horror", 1280, 800, "screenshot-2-horror.png"],
  ["fd", 1280, 800, "screenshot-3-frankenstein-dracula.png"],
  ["popup", 1280, 800, "screenshot-4-popup.png"],
  ["upload", 1280, 800, "screenshot-5-custom-upload.png"],
  ["promo", 440, 280, "promo-small-440x280.png"],
  ["marquee", 1400, 560, "promo-marquee-1400x560.png"],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting
    }
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}

function client(url) {
  const ws = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();
  const waiters = [];
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method) {
      waiters.filter((w) => w.method === msg.method).forEach((w) => w.resolve(msg.params));
    }
  };
  return new Promise((resolve) => {
    ws.onopen = () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((res, rej) => {
            const id = ++nextId;
            pending.set(id, (msg) => (msg.error ? rej(new Error(msg.error.message)) : res(msg.result)));
            ws.send(JSON.stringify({ id, method, params }));
          }),
        once: (method) => new Promise((res) => waiters.push({ method, resolve: res })),
        close: () => ws.close(),
      });
  });
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "store-render-"));
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ]);

  try {
    const cdp = await client(await connect());
    await cdp.send("Page.enable");
    for (const [shot, width, height, file] of SHOTS) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
      const loaded = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url: `${PAGE}?shot=${shot}` });
      await loaded;
      await sleep(400); // let images decode
      const { data } = await cdp.send("Page.captureScreenshot", {
        format: "png",
        clip: { x: 0, y: 0, width, height, scale: 1 },
      });
      fs.writeFileSync(path.join(OUT_DIR, file), Buffer.from(data, "base64"));
      console.log(`✅ ${file} (${width}x${height})`);
    }
    cdp.close();
  } finally {
    chrome.kill();
    await sleep(500);
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
