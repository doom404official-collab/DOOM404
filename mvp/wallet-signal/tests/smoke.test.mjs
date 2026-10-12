import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(resolve(root, "app/page.js"), "utf8");
const liquidity = readFileSync(resolve(root, "app/api/token-liquidity/route.js"), "utf8");
const extensions = readFileSync(resolve(root, "app/api/token-extensions/route.js"), "utf8");
const concentration = readFileSync(resolve(root, "app/api/token-concentration/route.js"), "utf8");

test("liquidity refresh is independent of token inspection", () => {
  assert.match(page, /async function refreshLiquidity\(/);
  assert.match(page, /REFRESH LIQUIDITY/);
  assert.match(page, /liquidityRefreshing/);
  assert.match(page, /observedAt/);
  assert.match(page, /if \(!cursor\) await refreshLiquidity\(mint\.trim\(\)\)/);
});
test("market-data claims remain explicitly limited", () => {
  assert.match(liquidity, /lpLocksVerified: false/);
  assert.match(liquidity, /withdrawalRightsVerified: false/);
  assert.match(liquidity, /provider: "DexScreener"/);
  assert.match(liquidity, /cache: "no-store"/);
  assert.match(liquidity, /pairAddress/);
});
test("fee inspection never treats unparsed fields as verified zero", () => {
  assert.match(extensions, /olderFee: normalizeFee/);
  assert.match(extensions, /newerFee: normalizeFee/);
  assert.match(extensions, /configAuthorityReported/);
  assert.match(extensions, /withdrawalAuthorityReported/);
  assert.match(extensions, /maximumFee === undefined/);
});
test("token accounts are not claimed as unique holders", () => {
  assert.match(concentration, /uniqueOwnersResolved: false/);
  assert.match(concentration, /isCompleteHolderList: false/);
});
test("security overview does not issue unsupported verdict", () => {
  assert.match(page, /Overall security verdict: Not issued/);
  assert.match(page, /Observed signals, not a safety rating/);
});
