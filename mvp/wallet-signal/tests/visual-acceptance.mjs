import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const base = process.env.WALLET_SIGNAL_BASE_URL || "http://127.0.0.1:3000";
await fs.mkdir("test-artifacts", { recursive: true });
const browser = await chromium.launch({ headless: true });
const viewports = [
  { name: "mobile-small", width: 360, height: 800 },
  { name: "mobile-standard", width: 393, height: 852 },
  { name: "desktop", width: 1440, height: 900 }
];
let failures = 0;
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    try {
      await page.goto(base, { waitUntil: "networkidle", timeout: 30000 });
      const address = page.locator("#wallet-address");
      const button = page.getByRole("button", { name: "ANALYZE WALLET" });
      const mascot = page.locator(".doom-mascot__image");
      await address.waitFor();
      await button.waitFor();
      await mascot.waitFor();
      const metrics = await page.evaluate(() => {
        const rect = selector => {
          const e = document.querySelector(selector);
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
        };
        return { input: rect("#wallet-address"), button: rect("button"), mascot: rect(".doom-mascot__image"),
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
          ringCount: document.querySelectorAll(".doom-mascot__ring").length };
      });
      await page.screenshot({ path: "test-artifacts/" + viewport.name + ".png", fullPage: true });
      assert.equal(metrics.horizontalOverflow, false, "Horizontal overflow");
      assert.equal(metrics.ringCount, 0, "Mascot ring must not exist");
      assert.ok(metrics.input && metrics.button && metrics.mascot);
      assert.ok(metrics.input.width > 100 && metrics.button.width > 100);
      assert.ok(metrics.button.bottom <= viewport.height, "Analyze button requires scrolling: bottom=" + metrics.button.bottom);
      console.log("PASS " + viewport.name + " " + JSON.stringify(metrics));
    } catch (error) {
      failures++;
      console.error("FAIL " + viewport.name + ": " + error.message);
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
if (failures) process.exitCode = 1;
