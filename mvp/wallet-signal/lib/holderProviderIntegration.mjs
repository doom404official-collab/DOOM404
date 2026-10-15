import {normalizeCreatorEvidence,normalizeTransferEvidence} from './concentrationEvidenceBridge.mjs';
import {assessHolderSnapshot} from './holderConcentrationAdapter.mjs';
// Integration boundary: accept only explicitly verified provider records.
// A verified creation transaction identifies a role, not complete team attribution.
export function assessWithProviderEvidence({snapshot,creatorOrigin={},tokenTransfers=[],excludedWallets=[],
 investigationComplete=false,creatorTeamVerified=false}={}) {
 const creator=normalizeCreatorEvidence(creatorOrigin);
 const edges=normalizeTransferEvidence(tokenTransfers);
 const creatorTeamWallets=creator.creatorWallet?[creator.creatorWallet]:[];
 const result=assessHolderSnapshot({snapshot,transferEdges:edges,creatorTeamWallets,excludedWallets,
   investigationComplete,creatorTeamVerified:creatorTeamVerified && creator.creatorWallet!==null});
 return {...result,evidence:{
  creatorOriginVerified:creator.creatorWallet!==null,
  creatorWallet:creator.creatorWallet,
  creationSignature:creator.creationSignature??null,
  verifiedTransferCount:edges.length,
  note:'Verified creation role is not proof of complete team attribution; transfer links do not prove common ownership.'
 }};
}
