import {summarizePoolSignatures} from './liquidityTransactionEvidence.mjs';
import {selectLiquidityTransactionSignatures} from './liquidityTransactionSelection.mjs';

// Pure selection function: the caller owns RPC execution.
export function selectFocusedLiquiditySignatures({requestedSignature, poolSignatures, excludeSignatures=[]}) {
  if (requestedSignature !== undefined &&
      (typeof requestedSignature !== 'string' ||
       !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(requestedSignature))) {
    throw Error('INVALID_TRANSACTION_SIGNATURE');
  }
  if (requestedSignature) {
    return {
      summary: {signatures:[],total:0},
      selection: {selected:[],excludedCount:0},
      selected: [{signature:requestedSignature,err:null}],
      requiresSignatureList:false
    };
  }
  if (!Array.isArray(poolSignatures)) throw Error('POOL_SIGNATURE_LIST_REQUIRED');
  const summary=summarizePoolSignatures(poolSignatures);
  const selection=selectLiquidityTransactionSignatures(summary.signatures,{
    limit:10,exclude:Array.isArray(excludeSignatures)?excludeSignatures:[]
  });
  return {summary,selection,selected:selection.selected,requiresSignatureList:true};
}
