(()=>{"use strict";
const button=document.getElementById("universal-report"),root=document.getElementById("universal-results"),field=document.getElementById("mint");
const emit=d=>window.dispatchEvent(new CustomEvent("doom404:broadcast-ready",{detail:d}));
async function get(path,mint){const r=await fetch(path+"?mint="+encodeURIComponent(mint),{cache:"no-store"});const d=await r.json();if(!r.ok||d.mint!==mint)throw Error(d.error||"Mint mismatch");return d}
function build(mint,h,r,context={}){
 const p=h.top20TokenAccountSharePercent,n=h.accounts.length, owners=h.accounts.filter(a=>a.ownerVerified).length;
 if(!Number.isFinite(p)||p<0||p>100||!n)throw Error("Concentration evidence unavailable or inconsistent");
 const valid=r&&r.scope.transactionsRetrieved>0, direct=valid?r.directTransfers.length:null;
 const share=p.toFixed(2)+"%", short=mint.slice(0,6)+"…"+mint.slice(-4);
 const identity=context.identity||{},m=context.market||{},sec=context.security;
 const name=identity.symbol?((identity.name||identity.symbol)+" ("+identity.symbol+")"):short;
 const usd=v=>"$"+Number(v).toLocaleString("en-US",{maximumSignificantDigits:5});
 const market=Number.isFinite(m.priceUsd)&&m.priceUsd>=0;
 const scenes=[
 {label:"TOKEN OVERVIEW",value:name,note:"SOLANA · "+short,caption:"Today we examine "+name+" on Solana."},
 {label:market?"MARKET OVERVIEW":"SUPPLY OBSERVATION",value:market?usd(m.priceUsd):String(h.supply.decimals)+" DECIMALS",note:market?"DEXSCREENER · SELECTED PAIR":"CONFIRMED RPC SUPPLY",caption:market?"The selected highest-liquidity reported pair quotes "+usd(m.priceUsd)+(Number.isFinite(m.volume24h)?", with 24-hour pair volume of "+usd(m.volume24h):"")+".":"Confirmed on-chain supply uses "+h.supply.decimals+" decimal places."},
 {label:"ACCOUNT CONCENTRATION",value:share,note:"TOKEN ACCOUNTS · NOT UNIQUE OWNERS",caption:"The largest "+n+" token accounts hold "+share+" of supply. The remaining "+(100-p).toFixed(2)+"% is outside these accounts."},
 {label:"OWNER RESOLUTION",value:owners+" / "+n,note:"CONTROLLING ADDRESSES",caption:"Controlling addresses were identified for "+owners+" of "+n+" sampled token accounts."},
 {label:"RECENT RELATIONSHIPS",value:valid?String(direct)+" OBSERVED":"UNAVAILABLE",note:valid?r.scope.transactionsRetrieved+" TRANSACTIONS RETRIEVED":"SAMPLE UNAVAILABLE",caption:valid?r.scope.transactionsRetrieved+" recent transactions were retrieved, with "+direct+" direct transfer observations between sampled addresses.":"Recent relationship evidence was unavailable or empty."},
 sec?{label:"TOKEN AUTHORITIES",value:sec.mintAuthority===null?"MINT AUTHORITY ABSENT":"MINT AUTHORITY SET",note:sec.freezeAuthority===null?"FREEZE AUTHORITY ABSENT":"FREEZE AUTHORITY SET",caption:"The mint authority is "+(sec.mintAuthority===null?"absent":"set")+", and the freeze authority is "+(sec.freezeAuthority===null?"absent":"set")+". These are on-chain authority settings."}:Number.isFinite(m.liquidityUsd)?{label:"PAIR LIQUIDITY",value:usd(m.liquidityUsd),note:"DEXSCREENER · SELECTED PAIR",caption:"The selected trading pair reports "+usd(m.liquidityUsd)+" in liquidity."}:{label:"INVESTIGATION COVERAGE",value:n+" ACCOUNTS",note:"BOUNDED HOLDER SAMPLE",caption:"The investigation covered "+n+" token accounts and "+(valid?r.scope.transactionsRetrieved:0)+" retrieved recent transactions."},
 {label:"LIMITATIONS",value:"PARTIAL EVIDENCE",note:"NOT A TOKEN SAFETY RATING",caption:"These observations come from separate RPC reads, not a synchronized snapshot. Beneficial ownership and historical funding remain unresolved. This is not a token safety rating."}];
 return {universal:true,eligible:true,mint,top20Share:p,observedAt:h.observedAt,identity,context,scenes,references:valid?r.directTransfers.filter(x=>x.signature).map(x=>({type:x.type,signature:x.signature,slot:x.slot})):[],evidence:{holders:h,recent:r||null},script:scenes.map(x=>x.caption).join(" ")}
}
window.doom404UniversalBuild=build;
button.addEventListener("click",async()=>{const mint=field.value.trim();emit({universal:true,eligible:false,blockers:["Research in progress"],scenes:[]});if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)){root.textContent="Enter a valid Solana mint.";return}button.disabled=true;root.textContent="Retrieving token accounts and bounded relationship evidence…";try{const h=await get("/api/owners",mint);let r=null;try{r=await get("/api/relationships",mint)}catch{}let context={};try{context=await get("/api/token-context",mint)}catch{}const d=build(mint,h,r,context);root.replaceChildren();for(const s of d.scenes){const p=document.createElement("p");p.textContent=s.label+" — "+s.caption;root.append(p)}const a=document.createElement("a");a.href="https://solscan.io/token/"+mint;a.textContent="Inspect mint on Solscan";a.target="_blank";a.rel="noopener noreferrer";root.append(a);emit(d)}catch(e){root.textContent=e.message;emit({universal:true,eligible:false,blockers:[e.message],scenes:[]})}finally{button.disabled=false}});
})();