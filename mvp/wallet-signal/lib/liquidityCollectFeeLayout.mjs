// Offline structural check against Pump's published collect_coin_creator_fee account order.
// This is NOT signer/ownership/PDA verification and cannot authorize a score.
import {PUMP_AMM_PROGRAM} from './liquidityHistoricalDecoder.mjs';
export const COLLECT_FEE_ACCOUNTS = Object.freeze([
  'quoteMint','quoteTokenProgram','coinCreator','coinCreatorVaultAuthority',
  'coinCreatorVaultAta','coinCreatorTokenAccount','eventAuthority','program'
]);
export function inspectCollectFeeLayout(event) {
  if (event?.operation !== 'collect_coin_creator_fee' ||
      event?.programId !== PUMP_AMM_PROGRAM) {
    return {status:'NOT_COLLECT_FEE_INSTRUCTION',proofVerified:false};
  }
  const accounts=event.rawInstruction?.accounts;
  if (!Array.isArray(accounts) || accounts.length !== COLLECT_FEE_ACCOUNTS.length) {
    return {status:'ACCOUNT_LAYOUT_UNAVAILABLE_OR_MISMATCH',proofVerified:false};
  }
  const keys=accounts.map(a=>typeof a==='string'?a:a?.pubkey);
  if (keys.some(k=>typeof k!=='string'||!k.length)) {
    return {status:'ACCOUNT_KEY_INVALID',proofVerified:false};
  }
  if (keys[7]!==PUMP_AMM_PROGRAM) {
    return {status:'PROGRAM_ACCOUNT_MISMATCH',proofVerified:false};
  }
  return {status:'STRUCTURAL_LAYOUT_CANDIDATE',proofVerified:false,
    accountRoles:Object.fromEntries(COLLECT_FEE_ACCOUNTS.map((role,i)=>[role,keys[i]])),
    needs:['historical_idl_version','pda_derivation','token_account_ownership',
      'execution_and_signer_authorization']};
}
