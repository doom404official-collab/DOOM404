export function selectLiquidityTransactionSignatures(signatures=[],{limit=10,exclude=[]}={}) {
 const ignored=new Set(exclude.filter(s=>typeof s==="string").slice(0,100));
 const selected=[];
 for(const item of signatures){
  if(item?.err!==null||typeof item?.signature!=="string"||ignored.has(item.signature))continue;
  selected.push(item);
  if(selected.length>=Math.min(10,Math.max(1,limit)))break;
 }
 return {selected,excludedCount:signatures.filter(s=>ignored.has(s?.signature)).length,selectionComplete:false};
}
