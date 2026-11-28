import * as policyCore from '../../lib/holderEligibleViewPolicy.mjs';
import * as frozenCore from '../../lib/holderFrozenObservation.mjs';
import * as lineageCore from '../../lib/holderCollectionLineage.mjs';
export const HOLDER_RETAIN19_POLICY=Object.freeze({
 id:'HOLDER_FROZEN_RETAIN19_V1',
 snapshotId:'1379bcb43b07be4b783dd4aa67bcabab50cc363cf36c4ca31c943204ccda0153',
 mint:'98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump',slot:457305617,
 infrastructurePool:'6e3jZLtf4tQbWZm3f7A66jF8tfZn6MRQVrbDFgcNWarA',
 approvalReference:'Sentinel_066b8879683c8191b27bf71130e93a9e',approvedAt:'2026-10-27T10:16:40Z'
});
const receipt={scope:'collection_to_persistence',snapshotId:HOLDER_RETAIN19_POLICY.snapshotId,mint:HOLDER_RETAIN19_POLICY.mint,slot:HOLDER_RETAIN19_POLICY.slot,runId:'38769967061',jobId:'116542887337',sourceCommit:'0fa974337ae4bdfd657628ec674be5555433fd9a',receiptObservedAt:'2026-10-15T16:33:50.3944072Z'};
export const buildApprovedHolderEligibleView=s=>policyCore.buildApprovedHolderEligibleView(s,HOLDER_RETAIN19_POLICY);
export const assessApprovedHolderEligibleConcentration=s=>policyCore.assessApprovedHolderEligibleConcentration(s,HOLDER_RETAIN19_POLICY);
export const projectHolderFrozenObservation=s=>frozenCore.projectHolderFrozenObservation(s,HOLDER_RETAIN19_POLICY);
export const readHolderFrozenObservation=(mint,opts={})=>frozenCore.readHolderFrozenObservation(mint,{...opts,policy:HOLDER_RETAIN19_POLICY,receipt});
export const canonicalHolderCollectionRow=s=>lineageCore.canonicalHolderCollectionRow(s,receipt);
export const verifyHolderCollectionLineage=(s,opts={})=>lineageCore.verifyHolderCollectionLineage(s,{...opts,receipt});
export const isVerifiedHolderCollectionLineage=lineageCore.isVerifiedHolderCollectionLineage;
