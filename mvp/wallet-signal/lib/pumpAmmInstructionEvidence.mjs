// Pump AMM public IDL instruction discriminators. Matching bytes alone is not verified execution.
const DISCRIMINATORS=new Map([
 ["66063d1201daebea","buy"],
 ["c62e1552b4d9e870","buy_exact_quote_in"],
 ["f223c68952e1f2b6","deposit"],
 ["33e685a4017f83ad","sell"],
 ["b712469c946da122","withdraw"]
]);
export function classifyPumpAmmInstruction(programId,data){
 if(programId!=="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA")return {candidate:null,verified:false};
 if(!Buffer.isBuffer(data)||data.length<8)return {candidate:null,verified:false};
 return {candidate:DISCRIMINATORS.get(data.subarray(0,8).toString("hex"))??null,verified:false,requiresSuccessfulTransaction:true,requiresPoolAccountMatch:true,requiresVaultBalanceEvidence:true};
}
