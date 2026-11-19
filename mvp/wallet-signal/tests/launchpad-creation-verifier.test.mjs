import test from "node:test";
import assert from "node:assert/strict";
import { verifyLaunchpadCreation } from "../lib/launchpadCreationVerifier.mjs";
const mint = "mint", signature = "signature";
const transaction = { meta: { err: null }, transaction: { message: { instructions: [{ programId: "known", data: "fixture" }] } } };
const decoder = ({ mint }) => ({ verified: true, mint, role: "launchpad_creator", creator: "creator", decoderVersion: "fixture-v1", creationInstructionVerified: true });
test("unregistered launchpad is unresolved", () => {
  assert.equal(verifyLaunchpadCreation({ mint, signature, transaction }).status, "UNRESOLVED");
});
test("registered strict decoder returns evidence", () => {
  const result = verifyLaunchpadCreation({ mint, signature, transaction, decoders: { known: decoder } });
  assert.equal(result.status, "VERIFIED");
  assert.equal(result.decodedRoles[0].programId, "known");
});
test("mismatched mint and incomplete decoder proof are rejected", () => {
  const wrong = () => ({ ...decoder({ mint }), mint: "other" });
  assert.equal(verifyLaunchpadCreation({ mint, signature, transaction, decoders: { known: wrong } }).status, "UNRESOLVED");
  const incomplete = () => ({ ...decoder({ mint }), creationInstructionVerified: false });
  assert.equal(verifyLaunchpadCreation({ mint, signature, transaction, decoders: { known: incomplete } }).status, "UNRESOLVED");
});
test("failed transaction is never verified", () => {
  assert.equal(verifyLaunchpadCreation({ mint, signature, transaction: { ...transaction, meta: { err: "failed" } }, decoders: { known: decoder } }).status, "UNRESOLVED");
});
test("conflicting creators are unresolved", () => {
  const tx = { ...transaction, transaction: { message: { instructions: [{ programId: "known", data: "a" }, { programId: "known", data: "b" }] } } };
  const result = verifyLaunchpadCreation({ mint, signature, transaction: tx, decoders: { known: ({ instruction }) => ({ ...decoder({ mint }), creator: instruction.data }) } });
  assert.equal(result.reason, "CONFLICTING_CREATOR_EVIDENCE");
});
