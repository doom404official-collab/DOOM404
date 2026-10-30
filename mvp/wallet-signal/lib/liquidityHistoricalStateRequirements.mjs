// Minimal historical account-state requirements for the fee operations actually observed.
// A requirement is not proof of historical account state.
export function historicalFeeStateRequirements({transactionSlot,feeSweeps=[]}={}){
 if(!Array.isArray(feeSweeps))throw Error("INVALID_FEE_SWEEPS");
 const relevant=feeSweeps.filter(s=>s?.poolMatched===true);
 const validSlot=Number.isSafeInteger(transactionSlot)&&transactionSlot>0;
 const accounts=new Map();
 const unresolved=[];
 for(const sweep of relevant){
  const creator=sweep.operation==="sweep_creator_fee";
  const protocol=sweep.operation==="sweep_protocol_fee";
  if(!creator&&!protocol){unresolved.push("UNSUPPORTED_FEE_OPERATION");continue;}
  const address=creator?sweep.pool:sweep.globalConfigAddress;
  if(typeof address!=="string"||!address.length){
   unresolved.push(creator?"POOL_ADDRESS_REQUIRED":"GLOBAL_CONFIG_ADDRESS_REQUIRED");
   continue;
  }
  const role=creator?"pump_amm_pool":"pump_amm_global_config";
  accounts.set(role+":"+address,{address,role,field:creator?"coin_creator":"protocol_fee_recipients"});
 }
 return {status:unresolved.length?"INVALID_OR_INCOMPLETE_EVIDENCE":"ARCHIVAL_STATE_REQUIRED",
  transactionSlot:validSlot?transactionSlot:null,accounts:[...accounts.values()],
  unresolved,requiredProof:"Independently authenticated account bytes and state applicable to transaction slot, with provenance and verified decoding",
  historicalStateAvailable:false,authorizationVerified:false};
}
