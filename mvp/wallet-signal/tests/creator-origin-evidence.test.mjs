import test from "node:test";
import assert from "node:assert/strict";
import { classifyCreatorEvidence } from "../lib/creatorOriginEvidence.mjs";

const mint = "mint-1";
const tx = (decodedRoles, extra = {}) => ({ mint, signature: "sig-1", programId: "program-1", meta: { err: null }, decodedRoles, ...extra });
const role = (role, address) => ({ role, address, verifiedInstruction: true });

test("fee payer is not inferred as launchpad creator", () => {
  const result = classifyCreatorEvidence({ mint, transactions: [tx([role("fee_payer", "payer")])] });
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.roles[0].role, "fee_payer");
});
test("verified launchpad creator is attributed with transaction evidence", () => {
  const result = classifyCreatorEvidence({ mint, transactions: [tx([role("launchpad_creator", "creator"), role("fee_payer", "payer")])] });
  assert.equal(result.status, "VERIFIED");
  assert.equal(result.roles[0].sourceSignature, "sig-1");
});
test("failed transactions and mismatched mints are excluded", () => {
  const result = classifyCreatorEvidence({ mint, transactions: [tx([role("launchpad_creator", "bad")], { meta: { err: "failed" } }), tx([role("launchpad_creator", "other")], { mint: "different" })] });
  assert.equal(result.status, "UNRESOLVED");
});
test("conflicting creator claims are not verified", () => {
  const result = classifyCreatorEvidence({ mint, transactions: [tx([role("launchpad_creator", "one"), role("launchpad_creator", "two")])] });
  assert.equal(result.status, "PARTIAL");
});
test("unverified decoded roles are excluded", () => {
  const result = classifyCreatorEvidence({ mint, transactions: [tx([{ role: "launchpad_creator", address: "unknown", verifiedInstruction: false }])] });
  assert.equal(result.status, "UNRESOLVED");
});
