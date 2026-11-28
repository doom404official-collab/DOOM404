import assert from "node:assert/strict";

const base = process.env.WALLET_SIGNAL_BASE_URL || "http://127.0.0.1:3000";
const routes = ["wallet", "transactions", "glitch"];
const validAddress = "11111111111111111111111111111111";
const cases = [
  { label: "missing", query: "", expected: 400 },
  { label: "invalid", query: "?address=not-a-solana-address", expected: 400 },
  { label: "malformed", query: "?address=%25%25%25", expected: 400 }
];

let failures = 0;
for (const route of routes) {
  for (const scenario of cases) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(base + "/api/" + route + scenario.query, { signal: controller.signal });
      assert.equal(response.status, scenario.expected, route + " " + scenario.label);
      const body = await response.json();
      assert.equal(typeof body.error, "string");
      console.log("PASS " + route + " " + scenario.label + ": HTTP " + response.status);
    } catch (error) {
      failures++;
      console.error("FAIL " + route + " " + scenario.label + ": " + error.message);
    } finally {
      clearTimeout(timeout);
    }
  }
}
if (failures) process.exitCode = 1;
