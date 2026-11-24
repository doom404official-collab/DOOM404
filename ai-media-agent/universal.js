(()=>{"use strict";
const button=document.getElementById("universal-report"),root=document.getElementById("universal-results"),field=document.getElementById("mint");
const emit=d=>window.dispatchEvent(new CustomEvent("doom404:broadcast-ready",{detail:d}));
async function get(path,mint){const r=await fetch(path+"?mint="+encodeURIComponent(mint),{cache:"no-store"});const d=await r.json();if(!r.ok||d.mint!==mint)throw Error(d.error||"Mint mismatch");return d}
function build(mint,h,r){
 const p=h.top20TokenAccountSharePercent,n=h.accounts.length, owners=h.accounts.filter(a=>a.ownerVerified).length;
 if(!Number.isFinite(p)||p<0||p>100||!n)throw Error("Concentration evidence unavailable or inconsistent");
 const valid=r&&r.scope.transactionsRetrieved>0, direct=valid?r.directTransfers.length:null;
 const share=p.toFixed(2)+"%", short=mint.slice(0,6)+"…"+mint.slice(-4);
 const scenes=[
 {label:"TOKEN OVERVIEW",value:short,note:"SOLANA MINT",caption:"DOOM404 Holder Intelligence for Solana mint ending "+mint.slice(-4)+"."},
 {label:"SUPPLY OBSERVATION",value:String(h.supply.decimals)+" DECIMALS",note:"RAW SUPPLY "+h.supply.raw,caption:"Token supply was retrieved on-chain using confirmed RPC reads. The mint has "+h.supply.decimals+" decimal places."},
 {label:"ACCOUNT CONCENTRATION",value:share,note:"TOKEN ACCOUNTS · NOT UNIQUE OWNERS",caption:"The largest "+n+" token accounts hold "+share+" of supply. This is account concentration, not independent ownership."},
 {label:"OWNER RESOLUTION",value:owners+" / "+n,note:"BENEFICIAL OWNERSHIP UNRESOLVED",caption:"Controlling addresses were resolved for "+owners+" of "+n+" token accounts. Their beneficial ownership and economic roles remain unresolved."},
 {label:"RECENT RELATIONSHIPS",value:valid?String(direct)+" OBSERVED":"UNAVAILABLE",note:valid?r.scope.transactionsRetrieved+" TRANSACTIONS RETRIEVED":"NO CLAIM OF INDEPENDENCE",caption:valid?"The bounded recent sample contained "+direct+" direct transfer observations across sampled addresses. This does not establish common ownership.":"Recent relationship evidence was unavailable or empty. No conclusion about wallet independence is justified."},
 {label:"COVERAGE LIMITS",value:"PARTIAL COVERAGE",note:"INFRASTRUCTURE / HISTORY UNRESOLVED",caption:"Pool, custody, infrastructure and historical funding attribution are not comprehensively verified in this report."},
 {label:"LIMITATIONS",value:"PARTIAL EVIDENCE",note:"NOT A TOKEN SAFETY RATING",caption:"These observations come from separate RPC reads, not a synchronized snapshot. This is not a token safety rating."}];
 return {universal:true,eligible:true,mint,top20Share:p,observedAt:h.observedAt,scenes,references:valid?r.directTransfers.filter(x=>x.signature).map(x=>({type:x.type,signature:x.signature,slot:x.slot})):[],evidence:{holders:h,recent:r||null},script:scenes.map(x=>x.caption).join(" ")}
}
window.doom404UniversalBuild=build;
button.addEventListener("click",async()=>{const mint=field.value.trim();emit({universal:true,eligible:false,blockers:["Research in progress"],scenes:[]});if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)){root.textContent="Enter a valid Solana mint.";return}button.disabled=true;root.textContent="Retrieving token accounts and bounded relationship evidence…";try{const h=await get("/api/owners",mint);let r=null;try{r=await get("/api/relationships",mint)}catch{}const d=build(mint,h,r);root.replaceChildren();for(const s of d.scenes){const p=document.createElement("p");p.textContent=s.label+" — "+s.caption;root.append(p)}const a=document.createElement("a");a.href="https://solscan.io/token/"+mint;a.textContent="Inspect mint on Solscan";a.target="_blank";a.rel="noopener noreferrer";root.append(a);emit(d)}catch(e){root.textContent=e.message;emit({universal:true,eligible:false,blockers:[e.message],scenes:[]})}finally{button.disabled=false}});
})();