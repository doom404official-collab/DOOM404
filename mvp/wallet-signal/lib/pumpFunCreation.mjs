import { createHash } from "node:crypto";
export const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function decode58(value) {
  if (typeof value !== "string" || !value) throw Error("INVALID_BASE58");
  let n = 0n;
  for (const char of value) { const i = alphabet.indexOf(char); if (i < 0) throw Error("INVALID_BASE58"); n = n * 58n + BigInt(i); }
  let hex = n.toString(16); if (hex.length % 2) hex = "0" + hex;
  return Buffer.concat([Buffer.alloc((value.match(/^1*/) || [""])[0].length), n === 0n ? Buffer.alloc(0) : Buffer.from(hex, "hex")]);
}
function encode58(bytes) {
  let n = BigInt("0x" + Buffer.from(bytes).toString("hex")), result = "";
  while (n > 0n) { result = alphabet[Number(n % 58n)] + result; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; result = "1" + result; }
  return result || "1";
}
function readString(bytes, offset, maxBytes) {
  if (offset + 4 > bytes.length) throw Error("TRUNCATED_STRING");
  const size = bytes.readUInt32LE(offset); offset += 4;
  if (size > maxBytes || offset + size > bytes.length) throw Error("INVALID_STRING_LENGTH");
  new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(offset, offset + size));
  return offset + size;
}
const keyString = (value) => typeof value === "string" ? value : value?.pubkey?.toString?.() || null;
export function decodePumpFunCreate({ instruction, transaction, mint, programId }) {
  if (programId !== PUMP_PROGRAM_ID || !instruction || typeof instruction.data !== "string") return null;
  const keys = transaction?.transaction?.message?.accountKeys?.map(keyString) || [];
  if (!Array.isArray(instruction.accounts)) return null;
  const accounts = instruction.accounts.map((entry) => Number.isInteger(entry) ? keys[entry] : keyString(entry));
  if (accounts.length < 8 || accounts[0] !== mint || !accounts.every(Boolean)) return null;
  let bytes;
  try { bytes = decode58(instruction.data); } catch { return null; }
  const kind = ["create", "create_v2"].find((name) => bytes.length >= 8 && bytes.subarray(0, 8).equals(createHash("sha256").update("global:" + name).digest().subarray(0, 8)));
  if (!kind) return null;
  try {
    let offset = 8;
    for (const max of [128, 52, 800]) offset = readString(bytes, offset, max);
    if (offset + 32 > bytes.length) return null;
    const creator = encode58(bytes.subarray(offset, offset + 32));
    if (creator === "11111111111111111111111111111111") return null;
    offset += 32;
    if (kind === "create" && offset !== bytes.length) return null;
    if (kind === "create_v2" && (offset >= bytes.length || ![0, 1].includes(bytes[offset]))) return null;
    const user = accounts[kind === "create" ? 7 : 5];
    if (!user) return null;
    return { verified: true, mint, role: "launchpad_creator", creator, user, decoderVersion: "pump-fun-" + kind + "-prefix-v1", creationInstructionVerified: true };
  } catch { return null; }
}
export const pumpFunDecoders = Object.freeze({ [PUMP_PROGRAM_ID]: decodePumpFunCreate });
