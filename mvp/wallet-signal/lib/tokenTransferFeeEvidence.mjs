// Matches the official Token-2022 getEpochFee / calculateFee semantics:
// https://github.com/solana-program/token-2022/blob/main/clients/js-legacy/src/extensions/transferFee/state.ts
const U64_MAX = (1n << 64n) - 1n;
export function uint64(value) {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) return null;
  if (!['string', 'number', 'bigint'].includes(typeof value) || !/^[0-9]+$/.test(String(value))) return null;
  const n = BigInt(value);
  return n <= U64_MAX ? n : null;
}
export function normalizeTransferFee(fee) {
  if (!fee || typeof fee !== 'object') return null;
  const bps = uint64(fee.transferFeeBasisPoints ?? fee.transfer_fee_basis_points ?? fee.basisPoints);
  const maximum = uint64(fee.maximumFee ?? fee.maximum_fee ?? fee.maximumFeeRaw);
  const epoch = uint64(fee.epoch);
  if (bps === null || bps > 10000n || maximum === null || epoch === null) return null;
  return { basisPoints: Number(bps), percentage: Number(bps) / 100, maximumFeeRaw: String(maximum), epoch: String(epoch) };
}
export function resolveEpochFee({ olderFee, newerFee, epoch } = {}) {
  const older = normalizeTransferFee(olderFee), newer = normalizeTransferFee(newerFee), current = uint64(epoch);
  if (!older || !newer || current === null || BigInt(older.epoch) > BigInt(newer.epoch)) return null;
  const schedule = current >= BigInt(newer.epoch) ? 'newer' : 'older';
  const fee = schedule === 'newer' ? newer : older;
  if (current < BigInt(fee.epoch)) return null;
  return { ...fee, schedule, observedEpoch: String(current) };
}
// Gross transfer amount and cap are raw token units, never floating-point UI amounts.
// No reference transfer size is invented for scoring.
export function calculateTransferFeeRaw(fee, amountRaw) {
  const normalized = normalizeTransferFee(fee), amount = uint64(amountRaw);
  if (!normalized || amount === null) return null;
  const rounded = (amount * BigInt(normalized.basisPoints) + 9999n) / 10000n;
  const cap = BigInt(normalized.maximumFeeRaw);
  return String(rounded > cap ? cap : rounded);
}
export function consistentEpochContext(before, after, accountSlot) {
  const first = uint64(before?.epoch), last = uint64(after?.epoch);
  const start = uint64(before?.absoluteSlot), end = uint64(after?.absoluteSlot), slot = uint64(accountSlot);
  if (first === null || last === null || start === null || end === null || slot === null || first !== last || start > slot || slot > end) return null;
  return { epoch: String(first), accountSlot: String(slot), beforeSlot: String(start), afterSlot: String(end), commitment: 'confirmed' };
}
