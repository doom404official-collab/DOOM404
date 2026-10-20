export function historicalFeeStateRequirements({transactionSlot,feeSweeps=[]}={}){
 const relevant=feeSweeps.filter(s=>s.poolMatched===true);
 const validSlot=Number.isSafeInteger(transactionSlot)&&transactionSlot>0;
 const accounts=[...new Map(relevant.flatMap(s=>[
  [s.pool,{address:s.pool,role:"pump_amm_pool",field:"coin_creator"}],
  [s.globalConfigAddress,{address:s.globalConfigAddress,role:"pump_amm_global_config",field:"protocol_fee_recipients"}]
 ]).filter(([address])=>typeof address==="string"&&address.length>0)).values()];
 return {status:"ARCHIVAL_STATE_REQUIRED",transactionSlot:validSlot?transactionSlot:null,accounts,requiredProof:"Independently authenticated account bytes and state applicable to transaction slot, with provenance and verified decoding",historicalStateAvailable:false,authorizationVerified:false};
}
