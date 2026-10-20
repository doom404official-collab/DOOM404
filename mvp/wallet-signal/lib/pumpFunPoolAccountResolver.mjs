import {PUMP_FUN_PROGRAM_ID} from './pumpFunSellCandidates.mjs';
/** Candidate Pump.fun bonding curve token account resolver.
 * Account layout must be independently validated before this is trusted as pool ownership.
 */
export function identifyPumpFunPoolTokenAccount({transaction,instruction,mint}={}){
 if(!transaction||!instruction||typeof mint!=='string')return {status:'UNVERIFIED',poolTokenAccount:null};
 const keys=(transaction.transaction?.message?.accountKeys||[]).map(k=>typeof k==='string'?k:k?.pubkey?.toString?.());
 const programId=instruction.programId||(Number.isInteger(instruction.programIdIndex)?keys[instruction.programIdIndex]:null);
 if(programId!==PUMP_FUN_PROGRAM_ID||!Array.isArray(instruction.accounts))
 return {status:'UNVERIFIED',poolTokenAccount:null};
 const accounts=instruction.accounts.map(x=>Number.isInteger(x)?keys[x]:typeof x==='string'?x:x?.pubkey?.toString?.());
 // Legacy Pump.fun sell account order: global, fee recipient, mint, bonding curve,
 // associated bonding curve, associated user, user, system, token, rent, event authority, program.
 if(accounts.length!==12||accounts[2]!==mint||!accounts[4]||!accounts[6])
 return {status:'UNVERIFIED',poolTokenAccount:null};
 return {status:'LAYOUT_CANDIDATE',poolTokenAccount:accounts[4],creatorAccount:accounts[6],
  mintBound:true,ownershipVerified:false,decoderVersion:'pump-fun-legacy-sell-accounts-candidate-v1'};
}
