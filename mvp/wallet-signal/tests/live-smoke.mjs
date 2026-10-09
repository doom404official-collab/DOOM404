import assert from "node:assert/strict";

const base = process.env.WALLET_SIGNAL_BASE_URL || "http://127.0.0.1:3000";
const address = "11111111111111111111111111111111"; // Public Solana address, not a private key.
const modules = ["wallet", "transactions", "glitch"];
let failed = 0;

for (const moduleName of modules) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(base + "/api/" + moduleName + "?address=" + address, { signal: controller.signal });
    const payload = await response.json();
    assert.equal(response.status, 200, moduleName + ": HTTP " + response.status + " " + JSON.stringify(payload));
    assert.equal(payload.address, address);
    assert.equal(payload.network, "mainnet-beta");
    if (moduleName === "wallet") {
      assert.equal(typeof payload.balanceSOL, "number");
      assert.ok(payload.dataCoverage && payload.intelligence);
    } else if (moduleName === "transactions") {
      assert.ok(Array.isArray(payload.transactions));
      assert.equal(typeof payload.signaturesRetrieved, "number");
    } else {
      assert.ok(Array.isArray(payload.transfers));
      assert.ok(payload.coverage);
    }
    console.log("PASS live " + moduleName + ": " + JSON.stringify({
      signatures: payload.signaturesRetrieved ?? payload.dataCoverage?.transactionsRetrieved ?? payload.coverage?.signaturesRetrieved,
      rateLimited: payload.rateLimited ?? payload.coverage?.rateLimited ?? false
    }));
  } catch (error) {
    failed++;
    console.error("FAIL live " + moduleName + ": " + error.message);
  } finally {
    clearTimeout(timer);
  }
}
if (failed) process.exitCode = 1;
