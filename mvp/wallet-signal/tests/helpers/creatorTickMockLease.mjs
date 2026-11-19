import {runCreatorIntelligenceTick as runTick} from '../../lib/creatorIntelligenceTick.mjs';
// Legacy in-memory fixtures model only stage/state. Supply their missing lease
// bookkeeping explicitly: successful claim records the actual requested owner,
// and subsequent reads expose it. Explicit owner fields (including mismatches)
// are never overridden. Production and boundary tests use the real tick directly.
export async function runCreatorIntelligenceTick({store,...options}){
 let leaseOwner=null;
 const leased={
  async get(...args){const row=await store.get(...args);return row&&!Object.hasOwn(row,'lease_owner')?{...row,lease_owner:leaseOwner}:row;},
  async claim(mint,owner,...args){const claimed=await store.claim(mint,owner,...args);if(claimed===true)leaseOwner=owner;return claimed;},
  save:(...args)=>store.save(...args)
 };
 return runTick({...options,store:leased});
}
