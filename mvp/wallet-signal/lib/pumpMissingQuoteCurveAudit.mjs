import { PublicKey } from "@solana/web3.js";
import { PUMP_PROGRAM_ID } from "./pumpFunCreation.mjs";
import { classifyPumpQuoteRemainingAccounts } from "./pumpQuoteLayoutClassification.mjs";
const key=x=>typeof x==="string"?x:x?.pubkey?.toString?.()||null;
const valid=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** Read-only diagnostic: investigate missing quote_bonding_curve in a 20-account
 * create_v2. A key appearing elsewhere in a transaction is NOT proof that it
 * was passed to the create instruction.
 */
export function auditMissingQuoteCurve({mint,transaction}){
 const msg=transaction?.transaction?.message||{};
 const keys=(msg.accountKeys||[]).map(key);
 const instructions=[...(msg.instructions||[]),...(transaction?.meta?.innerInstructions||[]).flatMap(g=>g.instructions||[])];
 const results=[];
 for(const ix of instructions){
  const program=key(ix?.programId)||(Number.isInteger(ix?.programIdIndex)?keys[ix.programIdIndex]:null);
  if(program!==PUMP_PROGRAM_ID||ix?.accounts?.length!==20)continue;
  const accounts=ix.accounts.map(x=>Number.isInteger(x)?keys[x]:key(x));
  if(accounts[0]!==mint||!valid.test(accounts[16]||""))continue;
  const classification=classifyPumpQuoteRemainingAccounts(accounts);
  const expected=classification.expectedQuoteCurve;
  const otherInstructions=instructions.filter(other=>other!==ix);
  const references=otherInstructions.filter(other=>(other.accounts||[]).some(a=>
   (Number.isInteger(a)?keys[a]:key(a))===expected)).length;
  results.push({quoteMint:accounts[16],expectedQuoteCurve:expected,
   presentInTransactionKeys:keys.includes(expected),
   presentInCreateInstruction:accounts.includes(expected),
   referencedInOtherInstructions:references,
   remainingAccountCount:accounts.length-16,
   classification:classification.status,
   quoteControlMatches:classification.quoteControlMatches,
   verified:false});
 }
 return results;
}
