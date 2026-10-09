import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PublicKey } from "@solana/web3.js";

// A random public address is overwhelmingly unlikely to have history.
// Only the public address is used. No keypair or private key is created.
const base = process.env.WALLET_SIGNAL_BASE_URL || "http://127.0.0.1:3000";
const emptyAddress = new PublicKey(randomBytes(32)).toBase58();
const cases = [
  { label: "empty-history", address: emptyAddress, expectedEmpty: true },
  { label: "system-program", address: "11111111111111111111111111111111", expectedEmpty: false }
];
const extra = process.env.WALLET_SIGNAL_ACTIVE_TEST_ADDRESS?.trim();
const highVolume = process.env.WALLET_SIGNAL_HIGH_VOLUME_TEST_ADDRESS?.trim();
const requireActive = process.env.WALLET_SIGNAL_REQUIRE_ACTIVE === "true";
if (requireActive && !extra) {
  throw new Error("Active-wallet validation requested, but WALLET_SIGNAL_ACTIVE_TEST_ADDRESS is missing.");
}
if (extra) {
  new PublicKey(extra); // fail early on invalid test configuration
  cases.push({ label: "configured-active", address: extra, expectedEmpty: false, requireHistory: true });
}
if (highVolume) {
  new PublicKey(highVolume);
  cases.push({ label: "configured-high-volume", address: highVolume, expectedEmpty: false, requireHistory: true });
}
if (!extra) console.warn("NOT TESTED: active wallet (set WALLET_SIGNAL_ACTIVE_TEST_ADDRESS)");
if (!highVolume) console.warn("NOT TESTED: high-volume wallet (set WALLET_SIGNAL_HIGH_VOLUME_TEST_ADDRESS)");
let failures = 0;
for (const scenario of cases) {
  for (const moduleName of ["wallet", "transactions", "glitch"]) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(base + "/api/" + moduleName + "?address=" + scenario.address, { signal: controller.signal });
      const body = await response.json();
      assert.equal(response.status, 200, moduleName + " " + scenario.label + ": " + JSON.stringify(body));
      assert.equal(body.address, scenario.address);
      assert.equal(body.network, "mainnet-beta");
      if (moduleName === "wallet") {
        assert.equal(typeof body.balanceSOL, "number");
        assert.ok(body.intelligence && body.dataCoverage);
        assert.equal(typeof body.dataCoverage.scoringEligible, "boolean");
        if (scenario.requireHistory) assert.ok(body.dataCoverage.transactionsRetrieved > 0, "Expected observed wallet history");
        if (scenario.expectedEmpty) {
          assert.equal(body.dataCoverage.transactionsRetrieved, 0);
          assert.equal(body.dataCoverage.scoringEligible, false);
        }
      } else if (moduleName === "transactions") {
        assert.ok(Array.isArray(body.transactions));
        assert.equal(typeof body.signaturesRetrieved, "number");
        if (scenario.expectedEmpty) assert.equal(body.signaturesRetrieved, 0);
        if (scenario.requireHistory) assert.ok(body.signaturesRetrieved > 0, "Expected observed transactions");
      } else {
        assert.ok(Array.isArray(body.transfers));
        assert.ok(body.coverage && body.evidence);
        assert.ok(["insufficient", "limited", "sample_only"].includes(body.evidence.confidence));
        if (scenario.expectedEmpty) assert.equal(body.evidence.confidence, "insufficient");
      }
      console.log("PASS " + scenario.label + " / " + moduleName);
    } catch (error) {
      failures++;
      console.error("FAIL " + scenario.label + " / " + moduleName + ": " + error.message);
    } finally {
      clearTimeout(timeout);
    }
  }
}
if (failures) process.exitCode = 1;
