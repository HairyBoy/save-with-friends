// UI smoke screenshots for the earning-vault flow. Requires playwright + a dev
// server running against the Celo fork (see contracts/script/dev-fork.sh):
//   NEXT_PUBLIC_CHAIN=celoFork NEXT_PUBLIC_FORK_RPC=http://127.0.0.1:8546 PORT=3010 npm run dev
//   BASE=http://localhost:3010 VAULT=y2 node e2e/smoke-shot.mjs
import { chromium } from "playwright";

const base = process.env.BASE ?? "http://localhost:3010";
const vault = process.env.VAULT ?? "y2"; // an existing earning vault id ("y"-prefixed)
const out = process.env.OUT ?? "/tmp";

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { localStorage.setItem("swf-onboarded", "1"); localStorage.setItem("swf.lang", "en"); });
const page = await ctx.newPage();

async function shot(path, file, settle = 2500) {
  await page.goto(base + path, { waitUntil: "load" });
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${out}/${file}`, fullPage: true });
  console.log("shot", file);
}

await shot("/create", "swf-create.png", 1500);
await shot(`/vault/${vault}`, "swf-vault.png", 3500);
const note = page.getByText(/liquidity/i).first();
if (await note.count()) {
  await note.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/swf-popup.png` });
  console.log("shot swf-popup.png");
}
await browser.close();
