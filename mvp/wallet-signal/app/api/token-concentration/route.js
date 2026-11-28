import {discoverHolderCandidates} from '../../../lib/holderCandidateExpansion.mjs';
import {classifyHolderAllocations} from '../../../lib/holderAllocationClassification.mjs';
import {withScannerAdmission} from '../../../lib/scannerAdmission.mjs';
import {withProviderUsage} from '../../../lib/providerUsage.mjs';
import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createReliableConnection } from "../../../lib/reliableConnection.js";
import { summarizeResolvedTokenAccounts } from "../../../lib/tokenAccountOwnership.js";

import { hasAlignedConcentrationContext } from "../../../lib/concentrationContext.mjs";

export const dynamic = "force-dynamic";

// RPC returns token ACCOUNTS, not unique beneficial owners. This is not holder concentration.
async function handle(request) {
  const address = new URL(request.url).searchParams.get("mint") || "";
  let mint;
  try { mint = new PublicKey(address); }
  catch { return NextResponse.json({ error: "Invalid token mint address" }, { status: 400 }); }
  const deadlineController=new AbortController(),deadlineTimer=setTimeout(()=>deadlineController.abort(),9000);
  try {
    const connection = createReliableConnection({primary:process.env.ALCHEMY_RPC_URL||process.env.ALCHEMY_SOLANA_ARCHIVE_RPC_URL||process.env.SOLANA_RPC_URL||process.env.HELIUS_RPC_URL,timeoutMs:2500,retries:0,maxResponseBytes:2000000,fetchImpl:(url,init)=>{
      if(deadlineController.signal.aborted)throw Error('READ_DEADLINE');
      return fetch(url,{...init,signal:AbortSignal.any([init.signal,deadlineController.signal,request.signal].filter(Boolean))});
    }});
    const [largest, supply] = await Promise.all([
      connection.getTokenLargestAccounts(mint, "confirmed"),
      connection.getTokenSupply(mint, "confirmed")
    ]);
    const ratioContext={commitment:"confirmed",largestAccountsSlot:largest.context?.slot??null,supplySlot:supply.context?.slot??null};
    const aligned=hasAlignedConcentrationContext({ratioContext});
    const total = BigInt(supply.value.amount);
    const accounts = largest.value.slice(0, 20).map((row, index) => ({
      rank: index + 1, tokenAccount: row.address.toBase58(),
      amount: row.amount, uiAmount: row.uiAmountString,
      sharePct: aligned && total > 0n ? Number(BigInt(row.amount) * 1000000n / total) / 10000 : null
    }));
    let candidateAddresses=accounts.map(row=>row.tokenAccount),candidateExpansion={status:'not_requested',newCandidates:0,rankingComplete:false};
    if(new URL(request.url).searchParams.get('extend')==='1'){
      if(!process.env.HELIUS_RPC_URL)candidateExpansion={status:'index_unavailable',reason:'existing_helius_endpoint_unconfigured',rankingComplete:false};
      else try{
        candidateExpansion=await discoverHolderCandidates({mint:mint.toBase58(),existing:candidateAddresses,lookupPage:async params=>{
          const response=await fetch(process.env.HELIUS_RPC_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'holder-candidate-expansion',method:'getTokenAccounts',params}),signal:AbortSignal.any([deadlineController.signal,AbortSignal.timeout(2500),request.signal].filter(Boolean)),cache:'no-store'});
          if(!response.ok)throw Error('HOLDER_INDEX_PROVIDER_ERROR');
          const reader=response.body.getReader(),parts=[];let bytes=0;
          try{while(true){const r=await reader.read();if(r.done)break;bytes+=r.value.byteLength;if(bytes>250000){await reader.cancel();throw Error('HOLDER_INDEX_RESPONSE_LIMIT');}parts.push(r.value);}}finally{reader.releaseLock();}
          const payload=JSON.parse(Buffer.concat(parts).toString());if(payload.error){const e=Error(payload.error.code===-32601?'HOLDER_INDEX_UNSUPPORTED':'HOLDER_INDEX_REJECTED');throw e;}return payload.result;
        }});candidateAddresses=candidateExpansion.addresses;
      }catch(e){candidateExpansion={status:'index_unavailable',reason:['HOLDER_INDEX_UNSUPPORTED','HOLDER_INDEX_REJECTED','HOLDER_INDEX_RESPONSE_LIMIT','INVALID_HOLDER_INDEX_PAGE','INVALID_HOLDER_INDEX_RECORD'].includes(e.message)?e.message.toLowerCase():'holder_index_provider_unavailable',rankingComplete:false};}
    }
    const parsedBatch = await connection.getMultipleParsedAccounts([mint,...candidateAddresses.map(x=>new PublicKey(x))],{commitment:"confirmed",minContextSlot:largest.context?.slot}).catch(()=>null);
    const ownership = summarizeResolvedTokenAccounts(accounts,accounts.map((_,i)=>parsedBatch?.value?.[i+1]?{context:parsedBatch.context,value:parsedBatch.value[i+1]}:null));
    const sampledMint=parsedBatch?.value?.[0]?.data?.parsed;
    const mintAccount=parsedBatch?.value?.[0],mintProgram=mintAccount?.owner?.toBase58?.();
    const sampledSupply=mintAccount?.executable===false&&['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(mintProgram)&&sampledMint?.type==='mint'&&sampledMint.info?.isInitialized===true&&/^(0|[1-9][0-9]{0,19})$/.test(sampledMint.info?.supply||'')&&BigInt(sampledMint.info.supply)<=18446744073709551615n?BigInt(sampledMint.info.supply):null;
    const ownerAddresses=[...new Set((parsedBatch?.value||[]).slice(1).map(a=>a?.data?.parsed?.info?.owner).filter(x=>typeof x==='string'))];
    const ownerBatch=sampledSupply!==null&&ownerAddresses.length?await connection.getMultipleAccountsInfoAndContext(ownerAddresses.map(x=>new PublicKey(x)),{commitment:"confirmed",minContextSlot:parsedBatch.context.slot}).catch(()=>null):null;
    const owners=new Map();
    if(Number.isSafeInteger(ownerBatch?.context?.slot)&&ownerBatch.context.slot>=parsedBatch.context.slot&&ownerBatch.value?.length===ownerAddresses.length)ownerAddresses.forEach((w,i)=>owners.set(w,ownerBatch.value[i]));
    const allocationClassification=sampledSupply!==null&&sampledSupply>0n?classifyHolderAllocations({mint:mint.toBase58(),supplyRaw:sampledSupply.toString(),accounts:candidateAddresses.map((address,i)=>({pubkey:address,account:parsedBatch?.value?.[i+1]})),ownerAccounts:owners,mintInfo:sampledMint.info}):null;
    const selectedWallets=(allocationClassification?.wallets||[]).sort((a,b)=>BigInt(a.amountRaw)>BigInt(b.amountRaw)?-1:BigInt(a.amountRaw)<BigInt(b.amountRaw)?1:a.wallet.localeCompare(b.wallet)).slice(0,20);
    const sampledGroups=new Map(selectedWallets.map(w=>[w.wallet,BigInt(w.amountRaw)]));
    const resolvedSampleAccounts=allocationClassification?.allocations.length||0,excludedSampleAccounts=allocationClassification?.allocations.filter(r=>!r.eligible).length||0;
    const values=[...sampledGroups.values()].sort((a,b)=>a>b?-1:a<b?1:0),sampleTotal=values.reduce((n,x)=>n+x,0n);
    const sampledWalletObservation=sampledSupply!==null&&sampledSupply>0n&&sampleTotal<=sampledSupply&&Number.isSafeInteger(parsedBatch?.context?.slot)?{
      version:2,allocationClassification,observedAt:new Date().toISOString(),observedSharePct:Number(sampleTotal*1000000n/sampledSupply)/10000,largestSharePct:values.length?Number(values[0]*1000000n/sampledSupply)/10000:0,
      wallets:[...sampledGroups].map(([wallet,amount])=>({wallet,amountRaw:amount.toString()})),eligibleWallets:sampledGroups.size,returnedAccounts:candidateAddresses.length,candidateExpansion,resolvedSampleAccounts,excludedSampleAccounts,rankingComplete:false,supplyRaw:sampledSupply.toString(),
      contextSlots:{discovery:largest.context?.slot,mint:parsedBatch.context.slot,sampledAccounts:parsedBatch.context.slot,classifications:ownerBatch?.context?.slot??null},atomicSubset:true,atomic:false,
      scope:'Same-slot balances and mint supply in the discovered account sample. Eligible system-wallet accounts are grouped; all restricted and unclassified allocations remain separately visible. Role classifications use a separate slot; custody, treasury and vesting are not inferred.'}:null;
    const sum = (n) => accounts.slice(0, n).reduce((a, x) => a + BigInt(x.amount), 0n);
    const percent = n => aligned && total > 0n ? Number(sum(n) * 1000000n / total) / 10000 : null;
    return NextResponse.json({
      status: "observed_token_accounts", ratioContext, sampledWalletObservation, mint: mint.toBase58(), decimals: supply.value.decimals,
      totalRawSupply: supply.value.amount, returnedAccounts: accounts.length,
      largestAccountSharePct: percent(1), top5TokenAccountSharePct: percent(5),
      top10TokenAccountSharePct: percent(10), top20TokenAccountSharePct: percent(20), accounts: ownership.accounts,
      ownership: { observedOwnerGroups: ownership.observedOwnerGroups,
        resolvedAccountCount: ownership.resolvedAccountCount,
        ownerCoverageComplete: false, beneficialOwnersVerified: false,
        warning: ownership.warning },
      coverage: { source: "Solana getTokenLargestAccounts + getTokenSupply", maxAccounts: 20,
        isCompleteHolderList: false, uniqueOwnersResolved: false, exchangePoolEscrowExcluded: false,candidateExpansion,
        warning: "Token accounts are not unique wallets or beneficial owners. Pools, exchanges, escrow and multiple accounts per owner can distort concentration. These are observed account balances, not a scam score." },
      interpretation: "Descriptive account-balance evidence only. No holder ownership or risk verdict inferred."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (failure) {
    const reason=deadlineController.signal.aborted?"provider_deadline":Number.isSafeInteger(failure?.code)?"provider_rpc_rejected":"provider_temporarily_unavailable";
    return NextResponse.json({ status: "unavailable", reason, error: "Largest token-account balances unavailable from RPC; do not infer concentration." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  } finally {clearTimeout(deadlineTimer);deadlineController.abort();}
}
export async function GET(request){
 return withScannerAdmission(request,async (request)=>{return withProviderUsage(handle,request);
 },"token-concentration");
}
