// Fail closed at persisted and endpoint evidence boundaries; no scoring policy here.
export function validateLiquidityPoolBatch(batch,mint,requested) {
 if (batch?.mint!==mint || !Array.isArray(batch.pools) || !Array.isArray(requested) || !requested.length || new Set(requested).size!==requested.length || batch.pools.length!==requested.length) throw Error("INVALID_LIQUIDITY_POOL_BATCH");
 const received=batch.pools.map(p=>p?.pairAddress);
 if (new Set(received).size!==received.length || received.some(address=>!requested.includes(address))) throw Error("INVALID_LIQUIDITY_POOL_BATCH");
 return true;
}
function observationTime(value) {
 if (typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return NaN;
 const time=Date.parse(value);
 if (!Number.isFinite(time) || new Date(time).toISOString().replace(".000Z","Z")!==value.replace(".000Z","Z")) return NaN;
 return time;
}
export function selectPreviousLiquidityCheckpoint(previous,mint,observedAt) {
 if (previous==null) return {checkpoint:null,reason:"no_previous_checkpoint"};
 const before=observationTime(previous.observedAt);
 const now=observationTime(observedAt);
 const validPools=Array.isArray(previous.pools) && previous.pools.every(p=>typeof p?.pairAddress==="string" && p.pairAddress.length>0) && new Set(previous.pools.map(p=>p.pairAddress)).size===previous.pools.length;
 if (previous.mint!==mint || !validPools || !Number.isFinite(before) || !Number.isFinite(now) || before>=now) return {checkpoint:null,reason:"incompatible_previous_checkpoint"};
 return {checkpoint:previous,reason:null};
}
