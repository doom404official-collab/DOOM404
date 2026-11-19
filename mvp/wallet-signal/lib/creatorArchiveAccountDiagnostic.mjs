import {createHash} from 'node:crypto';
const PROGRAM='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const DISCRIMINATOR=createHash('sha256').update('account:Global').digest().subarray(0,8);
// Buffer.from is permissive: reject malformed/non-canonical RPC base64 first.
function decodeAccountData(data){
 if(!Array.isArray(data)||data.length!==2||data[1]!=='base64'||typeof data[0]!=='string')return null;
 const encoded=data[0];
 if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))return null;
 const bytes=Buffer.from(encoded,'base64');
 return bytes.toString('base64')===encoded?bytes:null;
}
/** Owner/discriminator diagnostics only, not versioned account-layout decoding.
 * A matching header, even at the requested slot, cannot establish historical
 * state, recipient authorization, or settlement eligibility.
 */
export function inspectCreatorArchiveAccountResponse({data,slot}={}){
 const contextSlot=data?.result?.context?.slot??null;
 const account=data?.result?.value;
 const hasAccount=Boolean(account);
 const supported=Number.isSafeInteger(slot)&&Number.isSafeInteger(contextSlot)&&contextSlot===slot&&hasAccount&&!data?.error;
 const ownerMatches=account?.owner===PROGRAM;
 const bytes=decodeAccountData(account?.data);
 const discriminatorMatches=Boolean(bytes&&bytes.length>=8&&bytes.subarray(0,8).equals(DISCRIMINATOR));
 return {status:data?.error?'PROVIDER_RPC_ERROR':supported?'SLOT_MATCHED_ACCOUNT_RESPONSE':'HISTORICAL_CAPABILITY_UNVERIFIED',
  slot,contextSlot,accountPresent:hasAccount,ownerMatches,discriminatorMatches,
  accountHeaderMatches:ownerMatches&&discriminatorMatches,
  accountDataBytes:bytes?.length??null,accountDataSha256:bytes?createHash('sha256').update(bytes).digest('hex'):null,
  accountLayoutValidated:false,historicalStateVerified:false,
  rpcErrorCode:data?.error?.code??null,
  rpcErrorMessage:typeof data?.error?.message==='string'?data.error.message.slice(0,180):null,
  feeRecipientRolesVerified:false,eligibleForLivePromotion:false};
}
