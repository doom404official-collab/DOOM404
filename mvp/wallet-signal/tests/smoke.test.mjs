import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(resolve(root, "app/page.js"), "utf8");
const dashboard = readFileSync(resolve(root, "app/GlitchV11Dashboard.jsx"), "utf8");
const liquidity = readFileSync(resolve(root, "app/api/token-liquidity/route.js"), "utf8");
const poolEvidence = readFileSync(resolve(root, "lib/poolEvidence.js"), "utf8");
const extensions = readFileSync(resolve(root, "app/api/token-extensions/route.js"), "utf8");
const concentration = readFileSync(resolve(root, "app/api/token-concentration/route.js"), "utf8");

test("liquidity refresh is independent of token inspection", () => {
  assert.match(page, /async function refreshLiquidity\(/);
  assert.match(page, /async function refreshLiquidity\(/);
  assert.match(dashboard, /Available Liquidity/);
  assert.match(page, /liquidityRefreshing/);
  assert.match(liquidity, /provider: "DexScreener"/);
  assert.match(page, /if \(!cursor\) await Promise\.race\(\[refreshLiquidity\(address,controller\.signal\),cancelled\]\)/);
});
test("market-data claims remain explicitly limited", () => {
  assert.match(liquidity, /lpLocksVerified: false/);
  assert.match(liquidity, /withdrawalRightsVerified: false/);
  assert.match(liquidity, /provider: "DexScreener"/);
  assert.match(liquidity, /cache: "no-store"/);
  assert.match(liquidity, /normalizeReportedPools\(payload, mint\)/);
  assert.match(poolEvidence, /pairAddress/);
  assert.match(poolEvidence, /lpLocksVerified: false/);
});
test("fee inspection never treats unparsed fields as verified zero", () => {
  assert.match(extensions, /olderFee: normalizeTransferFee/);
  assert.match(extensions, /newerFee: normalizeTransferFee/);
  assert.match(extensions, /configAuthorityReported/);
  assert.match(extensions, /withdrawalAuthorityReported/);
  assert.match(extensions, /tokenTransferFeeEvidence/);
});
test("token accounts are not claimed as unique holders", () => {
  assert.match(concentration, /uniqueOwnersResolved: false/);
  assert.match(concentration, /isCompleteHolderList: false/);
});
test("security overview does not issue unsupported verdict", () => {
  assert.match(dashboard, /GLITCH \/\/ OVERALL TOKEN ASSESSMENT/);
  assert.match(dashboard, /Final score:/);
  assert.match(dashboard, /g11-attribute-tabs/);
  assert.doesNotMatch(dashboard, /Token Intelligence Score:/);
  assert.match(dashboard, /Final score/);
  assert.match(dashboard, /adaptDashboardEvidence/);
});

test("pool-account evidence is opt-in and never presented as LP-lock verification", () => {
  assert.match(page, /\/api\/pool-account-evidence/);
  assert.match(dashboard, /LP Security/);
  assert.match(dashboard, /LP custody/);
  assert.match(page, /setPoolEvidence\(null\)/);
});

test("creator launchpad panel distinguishes observation from verified creator", () => {
  assert.match(dashboard, /Creator Identification/);
  assert.match(dashboard, /Not independently verified/);
  assert.match(dashboard, /adapted.creatorVerified/);
});
