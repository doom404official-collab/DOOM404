"use client";
import {useEffect,useState} from "react";
// Read-only progress. Polling never initiates RPC investigations.
export default function HolderScanProgress({mint}){
 const [state,setState]=useState({status:"loading",scan:null});
 useEffect(()=>{
  if(!mint){setState({status:"not_started",scan:null});return;}
  let alive=true;
  const controller=new AbortController();
  const refresh=async()=>{
   try{
    const r=await fetch("/api/holder-scan-status?mint="+encodeURIComponent(mint),{
     cache:"no-store",signal:controller.signal});
    if(!r.ok)throw Error("STATUS_UNAVAILABLE");
    const body=await r.json();
    if(alive)setState({status:body.status,scan:body.scan??null});
   }catch(e){if(alive&&e.name!=="AbortError")setState({status:"unavailable",scan:null});}
  };
  refresh();
  const timer=setInterval(refresh,12000);
  return ()=>{alive=false;clearInterval(timer);controller.abort();};
 },[mint]);
 const status=state.status;
 if(status==="not_started")return <p role="status">No historical holder investigation is queued for this token.</p>;
 if(status==="unavailable")return <p role="status">Investigation progress is temporarily unavailable.</p>;
 if(status==="loading")return <p role="status">Checking investigation progress…</p>;
 const scan=state.scan??{};
 const checked=Number(scan.transactionsChecked);
 const reached=Number(scan.walletHistoriesReached);
 return <section aria-live="polite" style={{background:"#151515",border:"1px solid #444",borderRadius:14,padding:16,marginTop:16}}>
  <strong>Historical investigation: {status.replaceAll("_"," ")}</strong>
  <p>{Number.isFinite(checked)?checked.toLocaleString()+" transactions checked":"Evidence processing in progress"}</p>
  <p>{Number.isFinite(reached)?reached+" holder histories reached":"Holder history coverage pending"}</p>
  <small>Progress updates automatically. Reaching a wallet history does not prove full archival coverage.</small>
 </section>;
}
