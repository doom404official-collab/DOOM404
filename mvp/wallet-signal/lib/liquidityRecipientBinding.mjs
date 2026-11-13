import {inspectCollectFeeLayout} from './liquidityCollectFeeLayout.mjs';

// Offline recipient comparison. Trusted account ownership and historical creator
// state must be verified independently; matching addresses alone is not proof.
export function assessCollectFeeRecipientBinding(event, reference) {
  const layout=inspectCollectFeeLayout(event);
  if (layout.status!=='DOCUMENTED_LAYOUT_CANDIDATE') {
    return Object.freeze({status:'LAYOUT_NOT_ESTABLISHED',recipientMatched:false,proofVerified:false});
  }
  if (!reference || typeof reference!=='object' ||
      typeof reference.creator!=='string' || !reference.creator ||
      typeof reference.destinationTokenAccount!=='string' || !reference.destinationTokenAccount) {
    return Object.freeze({status:'REFERENCE_UNAVAILABLE',recipientMatched:false,proofVerified:false});
  }
  const recipientMatched=layout.accountRoles.coinCreator===reference.creator &&
    layout.accountRoles.coinCreatorTokenAccount===reference.destinationTokenAccount;
  return Object.freeze({
    status:recipientMatched?'RECIPIENT_ADDRESS_MATCH_UNVERIFIED':'RECIPIENT_ADDRESS_MISMATCH',
    recipientMatched,proofVerified:false,
    needs:Object.freeze(['reference_slot_provenance','historical_creator_state',
      'destination_token_account_owner','quote_mint_and_token_program',
      'pda_derivation','transaction_execution'])
  });
}
