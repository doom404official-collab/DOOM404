// Evidence bridge: a provider's creator label is not proof of team-wallet coverage.
// A confirmed creation transaction identifies a creator role, not all team wallets.
export function normalizeCreatorEvidence({creatorWallet,creationSignature,verifiedOnChain=false,role='mint_creator'}={}) {
 const address=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 const signature=/^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
 if(!address.test(creatorWallet??'') || !signature.test(creationSignature??'') || verifiedOnChain!==true)
  return {creatorTeamWallets:[],creatorTeamVerified:false,creatorWallet:null,reason:'Creator origin not verified on chain'};
 return {creatorTeamWallets:[creatorWallet],creatorTeamVerified:false,creatorWallet,
  creatorRole:role,creationSignature,
  reason:'Creator origin verified; full creator/team wallet set not independently established'};
}
// Transfer edges must include a confirmed on-chain token transfer signature and both owners.
// Do not infer that wallet owners are the same person.
export function normalizeTransferEvidence(records=[]) {
 if(!Array.isArray(records)) throw new TypeError('Transfer records must be an array');
 const address=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 const signature=/^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
 return records.filter(r=>r && address.test(r.from??'') && address.test(r.to??'') &&
   r.from!==r.to && signature.test(r.signature??'') && r.verifiedOnChain===true &&
   r.tokenTransferVerified===true)
  .map(r=>({from:r.from,to:r.to,signature:r.signature,verifiedTransfer:true,
   strength:r.strength==='strong'?'strong':'moderate'}));
}
