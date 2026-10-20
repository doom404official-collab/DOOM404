// Compare bounded provider inventories; absence does not prove pool closure.
export function comparePoolInventories(previous=[],current=[]) {
 const previousSet=new Set(previous.filter(x=>typeof x==="string"));
 const currentSet=new Set(current.filter(x=>typeof x==="string"));
 return {
  previouslyObserved:previousSet.size,
  currentlyObserved:currentSet.size,
  retained:[...currentSet].filter(x=>previousSet.has(x)),
  newlyReported:[...currentSet].filter(x=>!previousSet.has(x)),
  missingFromCurrentReport:[...previousSet].filter(x=>!currentSet.has(x)),
  completeOnChainInventory:false,
  missingPoolSafetyConclusion:null
 };
}
