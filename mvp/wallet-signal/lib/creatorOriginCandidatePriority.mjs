/** Sort indexed creation candidates by earliest known slot/time.
 * A candidate is not proof of creator attribution.
 */
export function prioritizeCreatorOriginCandidates({mint,candidates=[],limit=25}={}){
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint||'')||!Array.isArray(candidates)||
 !Number.isInteger(limit)||limit<1||limit>100)throw Error('INVALID_ORIGIN_CANDIDATES');
 const unique=new Map();
 for(const item of candidates){
  if(!item||typeof item.signature!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(item.signature)||
   (item.mint&&item.mint!==mint))continue;
  if(!unique.has(item.signature))unique.set(item.signature,item);
 }
 return [...unique.values()].sort((a,b)=>{
  const as=Number.isSafeInteger(a.slot)?a.slot:Number.MAX_SAFE_INTEGER;
  const bs=Number.isSafeInteger(b.slot)?b.slot:Number.MAX_SAFE_INTEGER;
  return as-bs||(Number.isSafeInteger(a.blockTime)?a.blockTime:Number.MAX_SAFE_INTEGER)-
   (Number.isSafeInteger(b.blockTime)?b.blockTime:Number.MAX_SAFE_INTEGER);
 }).slice(0,limit).map(x=>({signature:x.signature,slot:x.slot??null,blockTime:x.blockTime??null,
  status:'UNVERIFIED_CANDIDATE'}));
}
