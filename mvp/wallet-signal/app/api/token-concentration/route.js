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
    const parsedBatch = await connection.getMultipleParsedAccounts([mint,...accounts.map(row=>new PublicKey(row.tokenAccount))],{commitment:"confirmed",minContextSlot:largest.context?.slot}).catch(()=>null);
    const ownership = summarizeResolvedTokenAccounts(accounts,accounts.map((_,i)=>parsedBatch?.value?.[i+1]?{context:parsedBatch.context,value:parsedBatch.value[i+1]}:null));
    const sampledMint=parsedBatch?.value?.[0]?.data?.parsed;
    const mintAccount=parsedBatch?.value?.[0],mintProgram=mintAccount?.owner?.toBase58?.();
    const sampledSupply=mintAccount?.executable===false&&['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(mintProgram)&&sampledMint?.type==='mint'&&sampledMint.info?.isInitialized===true&&/^(0|[1-9][0-9]{0,19})$/.test(sampledMint.info?.supply||'')&&BigInt(sampledMint.info.supply)<=18446744073709551615n?BigInt(sampledMint.info.supply):null;
    const sampledGroups=new Map();let excludedSampleAccounts=0,resolvedSampleAccounts=0;
    for(let i=0;i<accounts.length;i++){
      const a=parsedBatch?.value?.[i+1],info=a?.data?.parsed?.type==='account'?a.data.parsed.info:null;
      const ownerProgram=a?.owner?.toBase58?.();
      if(a?.executable!==false||!info||info.mint!==mint.toBase58()||!['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(ownerProgram)||typeof info.owner!=='string'||! /^(0|[1-9][0-9]{0,19})$/.test(info.tokenAmount?.amount||''))continue;
      resolvedSampleAccounts++;
      if(info.owner==='1nc1nerator11111111111111111111111111111111'||!PublicKey.isOnCurve(new PublicKey(info.owner).toBytes())){excludedSampleAccounts++;continue;}
      sampledGroups.set(info.owner,(sampledGroups.get(info.owner)||0n)+BigInt(info.tokenAmount.amount));
    }
    const candidateOwners=[...sampledGroups.keys()];
    const ownerBatch=sampledSupply!==null&&candidateOwners.length?await connection.getMultipleAccountsInfoAndContext(candidateOwners.map(x=>new PublicKey(x)),{commitment:"confirmed",minContextSlot:parsedBatch.context.slot}).catch(()=>null):null;
    for(let i=0;i<candidateOwners.length;i++){
      const a=ownerBatch?.value?.[i];
      if(!Number.isSafeInteger(ownerBatch?.context?.slot)||ownerBatch.context.slot<parsedBatch.context.slot||ownerBatch.value?.length!==candidateOwners.length||a!==null&&(a?.owner?.toBase58?.()!=="11111111111111111111111111111111"||a.executable!==false))sampledGroups.delete(candidateOwners[i]);
    }
    const values=[...sampledGroups.values()].sort((a,b)=>a>b?-1:a<b?1:0),sampleTotal=values.reduce((n,x)=>n+x,0n);
    const sampledWalletObservation=sampledSupply!==null&&sampledSupply>0n&&sampleTotal<=sampledSupply&&Number.isSafeInteger(parsedBatch?.context?.slot)?{
      version:2,observedAt:new Date().toISOString(),observedSharePct:Number(sampleTotal*1000000n/sampledSupply)/10000,largestSharePct:values.length?Number(values[0]*1000000n/sampledSupply)/10000:0,
      wallets:[...sampledGroups].map(([wallet,amount])=>({wallet,amountRaw:amount.toString()})),eligibleWallets:sampledGroups.size,returnedAccounts:accounts.length,resolvedSampleAccounts,excludedSampleAccounts,rankingComplete:false,supplyRaw:sampledSupply.toString(),
      contextSlots:{discovery:largest.context?.slot,mint:parsedBatch.context.slot,sampledAccounts:parsedBatch.context.slot,classifications:ownerBatch?.context?.slot??null},atomicSubset:true,atomic:false,
      scope:'Same-slot balances and mint supply within a discovered largest-account sample; on-curve authorities grouped, PDA, observed program-owned and incinerator authorities excluded; classifications use a separate slot. Not a complete eligible-wallet ranking, beneficial ownership proof or custodian classification.'}:null;
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
        isCompleteHolderList: false, uniqueOwnersResolved: false, exchangePoolEscrowExcluded: false,
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
