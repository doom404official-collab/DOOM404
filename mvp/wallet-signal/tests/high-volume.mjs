import assert from "node:assert/strict";

// Read-only Mainnet pagination stress check. No private keys or transactions.
const address = process.env.WALLET_SIGNAL_HIGH_VOLUME_TEST_ADDRESS;
if (!address) throw new Error("Set WALLET_SIGNAL_HIGH_VOLUME_TEST_ADDRESS to a public, independently verified high-activity address.");
const minimum = Number(process.env.WALLET_SIGNAL_MIN_SIGNATURES || 1000);
if (!Number.isInteger(minimum) || minimum < 1000) throw new Error("Minimum must be >= 1000 for pagination testing.");
const base = process.env.WALLET_SIGNAL_BASE_URL || "http://127.0.0.1:3000";
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 180000);
const started = Date.now();
try {
  const response = await fetch(base + "/api/wallet?address=" + encodeURIComponent(address), { signal: controller.signal });
  const body = await response.json();
  assert.equal(response.status, 200, "Wallet API HTTP " + response.status + ": " + JSON.stringify(body).slice(0, 400));
  assert.equal(body.address, address);
  assert.equal(body.network, "mainnet-beta");
  const coverage = body.dataCoverage;
  assert.ok(coverage, "Coverage metadata required");
  assert.ok(coverage.transactionsRetrieved >= minimum,
    "Only " + coverage.transactionsRetrieved + " signatures returned; minimum " + minimum + " required");
  assert.ok(coverage.pagesFetched >= 2,
    "Pagination not exercised: " + coverage.pagesFetched + " page(s)");
  assert.equal(typeof coverage.scoringEligible, "boolean");
  console.log("PASS high-volume Mainnet pagination " + JSON.stringify({
    address, signatures: coverage.transactionsRetrieved, pages: coverage.pagesFetched,
    reachedEnd: coverage.reachedEnd, scoringEligible: coverage.scoringEligible,
    elapsedMs: Date.now() - started
  }));
} finally {
  clearTimeout(timeout);
}
