import {PublicKey} from "@solana/web3.js";
const ATA_PROGRAM=new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const PUMP_PROGRAM="pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
export function assessFeeRecipientAuthorization(sweeps=[],{poolState=null,globalConfig=null}={}){
 const results=sweeps.filter(s=>s.poolMatched).map(s=>{
  try{
   const owner=new PublicKey(s.recipient),mint=new PublicKey(s.quoteMint),tokenProgram=new PublicKey(s.quoteTokenProgram);
   const expected=PublicKey.findProgramAddressSync([owner.toBuffer(),tokenProgram.toBuffer(),mint.toBuffer()],ATA_PROGRAM)[0].toBase58();
   const ataMatched=expected===s.recipientTokenAccount;
   const poolCreatorMatched=s.operation==="sweep_creator_fee"&&poolState?.coinCreator===s.recipient;
   return {operation:s.operation,recipient:s.recipient,recipientTokenAccount:s.recipientTokenAccount,ataMatched,poolCreatorMatched:poolCreatorMatched||false,protocolRecipientConfigured:false,authorizationVerified:false,status:ataMatched?"ATA_DERIVATION_MATCHED_POLICY_PENDING":"ATA_MISMATCH"};
  }catch{return {operation:s.operation,status:"INVALID_ACCOUNT_EVIDENCE",authorizationVerified:false};}
 });
 return {results,authorizationVerified:false,protocolConfigurationVerified:false,settlementVerified:false};
}
