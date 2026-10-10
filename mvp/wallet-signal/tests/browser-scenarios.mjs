import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
await fs.mkdir("test-artifacts", { recursive: true });

const base = process.env.WALLET_SIGNAL_BASE_URL || "http://127.0.0.1:3000";
const address = "11111111111111111111111111111111";
const browser = await chromium.launch({ headless: true });
const walletPayload = (count, eligible = false) => ({
  address, network: "mainnet-beta", balanceSOL: 0,
  transactionsAnalyzed: count,
  dataCoverage: { transactionsRetrieved: count, scoringEligible: eligible, coverage: {} },
  activity: { activeDaysObserved: count ? 12 : 0, weeklyActivity: [] },
  intelligence: { scoringStatus: eligible ? "preliminary" : "insufficient_data",
    scoringExplanation: count ? "Observed history." : "No observable history." }
});
const respond = (payload, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(payload) });
async function scenario(name, config) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  try {
    await page.route("**/api/**", async route => {
      const pathname = new URL(route.request().url()).pathname;
      const key = pathname.split("/").pop();
      if (config.failWallet && key === "wallet") return route.fulfill(respond({ error: "RPC unavailable" }, 503));
      if (config.failOptional && key === "glitch") return route.fulfill(respond({ error: "GLITCH temporarily unavailable" }, 503));
      if (key === "wallet") return route.fulfill(respond(walletPayload(config.count, config.eligible)));
      if (key === "transactions") return route.fulfill(respond({ address, network: "mainnet-beta", transactions: [], categories: {}, signaturesRetrieved: config.count }));
      if (key === "glitch") return route.fulfill(respond({ address, network: "mainnet-beta", transfers: [], coverage: {}, summary: {} }));
      return route.continue();
    });
    await page.goto(base, { waitUntil: "networkidle" });
    assert.equal(await page.locator("#wallet-results").count(), 0, "Results must start hidden");
    const before = await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 3);
    assert.equal(before, true, "Pre-analysis page should not scroll");
    await page.locator("#wallet-address").fill(address);
    await page.getByRole("button", { name: "ANALYZE WALLET" }).click();
    await page.getByText(/Analysis (complete|failed)|Wallet overview complete|Signal ready/i).first().waitFor({ timeout: 15000 });
    const results = page.locator("#wallet-results");
    if (config.failWallet) {
      assert.equal(await results.count(), 0, "Core RPC failure must not expose results");
      await page.getByText(/Analysis failed/).waitFor();
      await page.screenshot({ path: "test-artifacts/scenario-core-rpc-failure.png", fullPage: true });
    } else {
      await results.waitFor();
      const sections = results.locator("details.doom-result-section");
      assert.ok(await sections.count() >= 2, "Results must have expandable sections");
      const overview = sections.filter({ has: page.locator("summary", { hasText: "01 // Wallet Overview" }) });
      const evidence = sections.filter({ has: page.locator("summary", { hasText: "GLITCH // Evidence Quality" }) });
      assert.equal(await overview.count(), 1, "Wallet Overview section exists");
      assert.equal(await evidence.count(), 1, "GLITCH Evidence Quality section exists");
      assert.equal(await overview.evaluate(e => e.open), true, "Overview defaults open");
      assert.equal(await evidence.evaluate(e => e.open), false, "Evidence defaults closed");
      await evidence.locator("summary").click();
      assert.equal(await evidence.evaluate(e => e.open), true, "Evidence section expands");
      await evidence.locator("summary").click();
      assert.equal(await evidence.evaluate(e => e.open), false, "Evidence section collapses");
      if (config.count === 0) {
        await page.getByText(/no observable transaction history/i).first().waitFor();
        assert.equal(await page.getByText("✓ SIGNAL READY").count(), 0);
      }
      if (config.failOptional) await page.getByText(/optional intelligence modules are unavailable/i).waitFor();
      if (config.eligible && !config.failOptional) await page.getByText("✓ SIGNAL READY").waitFor();
      assert.ok(await results.isVisible(), "Results must be visible before the visual capture");
      await page.screenshot({ path: "test-artifacts/scenario-" + name.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase() + ".png", fullPage: true });
      await page.locator("#wallet-address").fill("11111111111111111111111111111112");
      assert.equal(await results.count(), 0, "Editing address must clear results");
    }

    console.log("PASS scenario: " + name);
  } finally { await page.close(); }
}
try {
  await scenario("new wallet with no history", { count: 0 });
  await scenario("active wallet eligible for scoring", { count: 42, eligible: true });
  await scenario("optional module failure", { count: 12, failOptional: true });
  await scenario("core RPC failure", { failWallet: true });
} finally { await browser.close(); }
