import { PublicKey } from "@solana/web3.js";
export const QUOTE_CONTROL="6z6GDdfb2AjR9ZhJmAUQ5cipJCVxQvLJhB2H8mCwTFBP";
const PUMP="6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
/** Diagnostic only. Official pump-coin-quoted create_v2 requires five trailing
 * accounts (or eight after migration); four trailing accounts are insufficient
 * to establish this variant, even if quote_control matches.
 */
export function classifyPumpQuoteRemainingAccounts(accounts){
 if(!Array.isArray(accounts)||accounts.length<16)return {status:"INVALID_ACCOUNTS"};
 const extra=accounts.slice(16);
 const quoteControlMatches=extra[3]===QUOTE_CONTROL;
 let quoteCurveExpected=null,quoteCurveMatches=false;
 try{
  if(extra[0]){
   const [curve]=PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"),new PublicKey(extra[0]).toBuffer()],new PublicKey(PUMP));
   quoteCurveExpected=curve.toBase58();
   quoteCurveMatches=extra[4]===quoteCurveExpected;
  }
 }catch{}
 return {status:extra.length===5&&quoteControlMatches&&quoteCurveMatches?"PUMP_QUOTE_LAYOUT_CANDIDATE":
  extra.length===8&&quoteControlMatches&&quoteCurveMatches?"PUMP_QUOTE_MIGRATED_LAYOUT_CANDIDATE":"UNSUPPORTED_OR_INCOMPLETE_LAYOUT",
  extraCount:extra.length,quoteControlMatches,quoteCurvePresent:Boolean(extra[4]),
  quoteCurveMatches,expectedQuoteCurve:quoteCurveExpected,
  decoderAccepted:false};
}
