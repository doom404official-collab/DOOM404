import { PublicKey } from "@solana/web3.js";
import { PUMP_PROGRAM_ID } from "./pumpFunCreation.mjs";

/** Diagnostic-only: identify whether an additional account is an expected PDA,
 * a transaction lookup-table key, or an unrelated remaining account.
 * This never verifies or modifies creator attribution.
 */
export function inspectExtraAccountContext({mint,transaction,extra}) {
 const message=transaction?.transaction?.message||{};
 const keys=(message.accountKeys||[]).map(x=>typeof x==="string"?x:x?.pubkey);
 const meta=transaction?.meta||{};
 const lookups=message.addressTableLookups||[];
 const writable=meta.loadedAddresses?.writable||[];
 const readonly=meta.loadedAddresses?.readonly||[];
 const knownSeeds=["global","mint-authority","__event_authority"];
 const candidates=[];
 for(const seed of knownSeeds){
  try{
   const [pda]=PublicKey.findProgramAddressSync([Buffer.from(seed)],new PublicKey(PUMP_PROGRAM_ID));
   if(pda.toBase58()===extra)candidates.push(seed);
  }catch{}
 }
 for(const seed of ["bonding-curve","mayhem-state"]){
  try{
   const [pda]=PublicKey.findProgramAddressSync([Buffer.from(seed),new PublicKey(mint).toBuffer()],new PublicKey(PUMP_PROGRAM_ID));
   if(pda.toBase58()===extra)candidates.push(seed);
  }catch{}
 }
 const keyIndex=keys.indexOf(extra);
 const instructionRefs=[...(message.instructions||[]),...(meta.innerInstructions||[]).flatMap(x=>x.instructions||[])]
  .filter(ix=>Array.isArray(ix.accounts)&&ix.accounts.some(a=>Number.isInteger(a)?keys[a]===extra:a===extra))
  .length;
 return {extra,knownPumpPdaSeeds:candidates,staticOrExpandedKeyIndex:keyIndex,
  loadedAddressPresent:[...writable,...readonly].includes(extra),
  addressLookupTableCount:lookups.length,instructionReferenceCount:instructionRefs,
  signerInMessage:typeof message.accountKeys?.[keyIndex]==="object"?
   message.accountKeys[keyIndex]?.signer===true:false,
  roleEstablished:candidates.length>0};
}
