"use client";
import {withConcentrationContext,hasAlignedConcentrationContext} from "../lib/concentrationContext.mjs";

import { useEffect, useRef, useState } from "react";
import {readDashboardEvidenceResponse} from '../lib/dashboardEvidenceRead.mjs';
import {createLiquidityReadController} from '../lib/liquidityReadController.mjs';
import HolderBubbleMap from "./HolderBubbleMap";
import {HOLDER_RETAIN19_POLICY,assessApprovedHolderEligibleConcentration} from '../lib/holderEligibleViewPolicy.mjs';
import {verifyHolderCollectionLineage} from '../lib/holderCollectionLineage.mjs';
import GlitchV11Dashboard from "./GlitchV11Dashboard";
import {reconcileHolderSnapshot} from "../lib/reconcileHolderSnapshot.mjs";
import {scoreHolderIntelligenceForDisplay as scoreHolderConcentration} from "../lib/holderIntelligenceDisplayV11.mjs";
import { assessGlitchEvidence } from "../lib/glitchRiskIndicators.js";
import { selectTokenInsights } from "../lib/tokenInsights.js";
import { assessTokenEvidence } from "../lib/tokenAssessmentV11.js";
import { assessTokenControls } from "../lib/tokenControlsDisplayV11.mjs";
import { assessCreatorAndLiquidityV11 } from "../lib/creatorLiquidityDisplayV11.mjs";
import { buildDecisionSummary } from "../lib/decisionSummary.js";

function formatCoverage(status) {
  const labels = {
    complete_sample: "Available sample fully checked",
    rpc_exhausted: "Available RPC history ended before the full period",
    partial_sample: "Only part of the period was checked",
    incomplete_sample: "Observation period not fully covered",
  };
  return labels[status] || (status ? String(status).replaceAll("_", " ") : "Not available");
}

const cardStyle = {
  background: "#151515",
  border: "1px solid #333",
  borderRadius: "12px",
  padding: "22px",
  marginTop: "16px"
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px"
};

function Metric({ label, value, note }) {
  return (
    <div style={{ ...cardStyle, marginTop: 0 }}>
      <div style={{ color: "#999", fontSize: "12px" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: "26px",
          fontWeight: "bold",
          marginTop: "10px",
          overflowWrap: "anywhere"
        }}
      >
        {value}
      </div>
      {note && (
        <div
          style={{
            color: "#888",
            fontSize: "12px",
            marginTop: "8px",
            lineHeight: 1.5
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}

function Section({ title, children, defaultOpen }) {
  const [expanded, setExpanded] = useState(defaultOpen ?? title.startsWith("01 //"));
  return (
    <details className="doom-result-section" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary className="doom-result-heading">
        <span>{title}</span><span className="doom-result-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="doom-result-content">{children}</div>
    </details>
  );
}

function formatDate(value) {
  if (!value) return "Unavailable";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleString();
}

function formatNumber(value, digits = 4) {
  if (value === null || value === undefined || value === "") return "Unavailable";
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "Unavailable";
  }

  return number.toLocaleString(undefined, {
    maximumFractionDigits: digits
  });
}

function AddressLink({ address, type = "account" }) {
  if (!address) {
    return <span>Unavailable</span>;
  }

  return (
    <a
      href={
        "https://solscan.io/" +
        type +
        "/" +
        encodeURIComponent(address)
      }
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "#ff7777",
        overflowWrap: "anywhere",
        textDecoration: "none"
      }}
    >
      {address}
    </a>
  );
}

function ErrorPanel({ message }) {
  return (
    <div style={cardStyle}>
      <p style={{ color: "#ff9999" }}>
        {message || "Data unavailable."}
      </p>
      <p style={{ color: "#999", fontSize: "13px" }}>
        Other intelligence modules can still be used.
      </p>
    </div>
  );
}


function MascotDisplay({ loading, complete, partial }) {
  const mode = loading ? "scanning" : complete ? "complete" : "idle";
  return (
    <div className={"doom-mascot doom-mascot--" + mode} aria-label={loading ? "DOOM404 robot scanning wallet" : complete ? "DOOM404 robot: preliminary signal ready" : partial ? "DOOM404 robot: partial analysis" : "DOOM404 robot ready"}>
      <div className="doom-mascot__beam" aria-hidden="true" />
      <img
        className="doom-mascot__image"
        src="/doom404-mascot.png..jpeg"
        alt="DOOM404 official red-hooded robot mascot"
        width="440"
        height="440"
      />
      <div className="doom-mascot__indicator" aria-live="polite">
        {loading ? "SCANNING" : complete ? "✓ SIGNAL READY" : partial ? "PARTIAL ANALYSIS" : "SYSTEM READY"}
      </div>
    </div>
  );
}

function DeepGlitchExplorer({ address }) {
  const [pages, setPages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const stopRequested = useRef(false);
  const activeRequest = useRef(null);
  useEffect(() => () => { stopRequested.current = true; activeRequest.current?.abort(); }, []);
  const assessment = assessGlitchEvidence(pages, { hasMore });
  const decoded = pages.reduce((sum, page) => sum + (page.coverage?.transactionsDecoded || 0), 0);
  const unavailable = pages.reduce((sum, page) => sum + (page.coverage?.transactionsUnavailable || 0), 0);
  const allTransfers = pages.flatMap(page => page.transfers || []);
  const transfers = allTransfers.length;
  const allSignatures = pages.flatMap(page => page.pagination?.pageSignatures || []);
  const uniqueSignatures = new Set(allSignatures);
  const coverageValid = allSignatures.length === uniqueSignatures.size;
  const counterparties = new Map();
  for (const transfer of allTransfers) {
    if (!transfer.counterparty || !["incoming", "outgoing"].includes(transfer.direction)) continue;
    const item = counterparties.get(transfer.counterparty) || { address: transfer.counterparty, interactions: 0, volumeSOL: 0 };
    item.interactions++;
    item.volumeSOL += Number(transfer.amountSOL || 0);
    counterparties.set(transfer.counterparty, item);
  }
  const ranked = [...counterparties.values()].sort((a, b) => b.volumeSOL - a.volumeSOL);
  const totalVolume = ranked.reduce((sum, item) => sum + item.volumeSOL, 0);
  const concentration = totalVolume > 0 ? (ranked[0].volumeSOL / totalVolume * 100).toFixed(2) : null;
  async function loadPages(automatic = false) {
    if (busy || !hasMore) return;
    const maxPages = automatic ? 5 : 1;
    stopRequested.current = false;
    setBusy(true);
    setAutoRunning(automatic);
    setError("");
    let nextCursor = cursor;
    let more = hasMore;
    const seen = new Set(uniqueSignatures);
    try {
      for (let index = 0; index < maxPages && more && !stopRequested.current; index++) {
        const controller = new AbortController();
        activeRequest.current = controller;
        const url = "/api/glitch?mode=deep&address=" + encodeURIComponent(address) + (nextCursor ? "&before=" + encodeURIComponent(nextCursor) : "");
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Deep analysis unavailable");
        const received = data.pagination?.pageSignatures;
        if (!Array.isArray(received) || received.length !== new Set(received).size || received.some(signature => seen.has(signature))) {
          throw new Error("Missing or duplicate transaction signatures; analysis halted to protect evidence integrity.");
        }
        received.forEach(signature => seen.add(signature));
        setPages(old => [...old, data]);
        setStarted(true);
        nextCursor = data.pagination?.nextCursor || null;
        more = Boolean(data.pagination?.hasMore);
        setCursor(nextCursor);
        setHasMore(more);
        if (!data.pagination?.pageComplete) {
          setError("Some transactions could not be decoded. Deep analysis paused; evidence is incomplete.");
          break;
        }
        if (more && !nextCursor) throw new Error("Pagination cursor missing; analysis halted.");
      }
    } catch (failure) {
      if (failure.name !== "AbortError") setError(failure.message);
    } finally {
      activeRequest.current = null;
      setBusy(false);
      setAutoRunning(false);
    }
  }
  return (
    <Section title="Deep GLITCH // Evidence Analysis">
      <div style={cardStyle}>
        <p style={{ color: "#ddd" }}>Decode additional RPC-visible transactions in 20-transaction pages. Each page is independently assessed; a wallet risk score is not yet available.</p>
        <p style={{ color: "#bbb" }}>Pages examined: {pages.length} · Unique signatures: {uniqueSignatures.size} · Transactions decoded: {decoded} · Unavailable: {unavailable} · Explicit SOL transfers: {transfers}</p>
        {started && <p style={{ color: "#bbb" }}>Cumulative counterparties: {counterparties.size} · Largest counterparty share of observed explicit SOL transfer volume: {concentration === null ? "Not enough data" : concentration + "%"}</p>}
        {started && <p style={{ color: coverageValid && unavailable === 0 ? "#83d4a0" : "#ffb86b" }}>Evidence integrity: {coverageValid ? "No duplicate signatures across loaded pages" : "Duplicate signatures detected"} · {unavailable === 0 ? "All requested records decoded" : "Some records unavailable"}</p>}
        {started && <p style={{ color: "#bbb" }}>{hasMore ? "More history may be available." : "No further history returned by this RPC; archival completeness not verified."}</p>}
        {started && <div style={{ borderTop: "1px solid #555", marginTop: 18, paddingTop: 16 }}>
          <h3 style={{ color: "#fff" }}>GLITCH // Experimental Risk Indicators</h3>
          <p style={{ color: "#ffbd80" }}>Assessment: {assessment.assessmentStatus.replaceAll("_", " ")} · Evidence confidence: {assessment.confidence} · Risk score: Not assessed</p>
          <p style={{ color: "#bbb" }}>Observed activity does not establish whether a wallet is safe or fraudulent.</p>
          <p style={{ color: "#aaa" }}>{assessment.confidenceExplanation}</p>
          <details style={{ marginBottom: 16 }}><summary style={{ cursor: "pointer", color: "#ddd" }}>How indicators are evaluated ({assessment.ruleChecks.length})</summary>
            {assessment.ruleChecks.map(rule => <div key={rule.id} style={{ padding: "10px 0", borderBottom: "1px solid #333" }}>
              <strong style={{ color: "#eee" }}>{rule.title}: {rule.triggered ? "Triggered" : "Not triggered"}</strong>
              <p style={{ color: "#bbb" }}>Threshold: {rule.threshold}</p>
              <p style={{ color: "#bbb" }}>Observed: {rule.observed}</p>
            </div>)}
          </details>
          {assessment.findings.length === 0 && <p style={{ color: "#bbb" }}>No supported behavioral findings under current rules. This does not mean the wallet is safe.</p>}
          {assessment.findings.map(finding => <div key={finding.id} style={{ borderTop: "1px solid #333", padding: "12px 0" }}>
            <strong style={{ color: "#fff" }}>{finding.title}</strong>
            <p style={{ color: "#bbb" }}>{finding.explanation}</p>
            <p style={{ color: "#aaa", fontSize: 12 }}>Rule: {finding.rule}</p>
            <p style={{ color: "#aaa", fontSize: 12 }}>Supporting transactions ({finding.supportingTransactions ?? finding.signatures.length}):</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {finding.signatures.map(signature => <a key={signature} href={"https://solscan.io/tx/" + encodeURIComponent(signature)} target="_blank" rel="noopener noreferrer" style={{ color: "#83d4ff", fontSize: 12, overflowWrap: "anywhere" }} title={signature}>{signature.slice(0, 10)}… ↗</a>)}
            </div>
            {finding.signatures.length < (finding.supportingTransactions || 0) && <p style={{ color: "#aaa", fontSize: 12 }}>Showing the first {finding.signatures.length} supporting signatures.</p>}
          </div>)}
          <details><summary style={{ cursor: "pointer", color: "#ddd" }}>Evidence limitations ({assessment.limitations.length})</summary>
            <ul style={{ color: "#aaa" }}>{assessment.limitations.map(note => <li key={note}>{note}</li>)}</ul>
          </details>
        </div>}
        {error && <p role="alert" style={{ color: "#ffb86b" }}>{error}</p>}
        {busy && <p role="status" style={{ color: "#ddd" }}>{autoRunning ? "Analyzing up to 5 pages in this batch. You can stop after the current request." : "Decoding current page..."}</p>}
        {hasMore && <button type="button" disabled={busy} onClick={() => loadPages(false)} style={{ background: "#a52222", color: "white", border: 0, borderRadius: 8, padding: "12px 18px" }}>{busy ? "DECODING..." : started ? "ANALYZE NEXT 20 TRANSACTIONS" : "RUN DEEP ANALYSIS"}</button>}
        {hasMore && !busy && <button type="button" onClick={() => loadPages(true)} style={{ marginLeft: 10, background: "#333", color: "white", border: "1px solid #777", borderRadius: 8, padding: "12px 18px" }}>ANALYZE NEXT 100 (AUTO)</button>}
        {busy && autoRunning && <button type="button" onClick={() => { stopRequested.current = true; }} style={{ marginLeft: 10, background: "#333", color: "white", border: "1px solid #777", borderRadius: 8, padding: "12px 18px" }}>STOP AFTER CURRENT PAGE</button>}
      </div>
    </Section>
  );
}

function HistoryExplorer({ address }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const requestId = useRef(0);

  async function loadMore() {
    if (busy || !hasMore) return;
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    try {
      const url = "/api/history?address=" + encodeURIComponent(address) + (cursor ? "&before=" + encodeURIComponent(cursor) : "");
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "History unavailable");
      if (id !== requestId.current) return;
      setItems(old => {
        const known = new Set(old.map(row => row.signature));
        return [...old, ...(data.items || []).filter(row => !known.has(row.signature))];
      });
      setCursor(data.pagination?.nextCursor || null);
      setHasMore(Boolean(data.pagination?.hasMore));
      setStarted(true);
    } catch (failure) {
      if (id === requestId.current) setError(failure.message);
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }

  return (
    <Section title="Transaction History // Explorer">
      <div style={cardStyle}>
        <p style={{ color: "#ddd" }}>Browse RPC-visible transaction signatures in pages. This does not yet decode all transaction details or establish complete chain-history coverage.</p>
        <p style={{ color: "#aaa" }}>Records loaded: {items.length}{started && !hasMore ? " · No further signatures returned by this RPC" : " · Total history unknown"}</p>
        {items.map(row => (
          <div key={row.signature} style={{ borderTop: "1px solid #333", padding: "12px 0", overflowWrap: "anywhere" }}>
            <span style={{ color: row.status === "success" ? "#83d4a0" : "#ff8888" }}>{row.status.toUpperCase()}</span>
            {" · "}{row.timestamp || "Timestamp unavailable"}
            <div style={{ fontSize: "12px", color: "#bbb" }}>{row.signature}</div>
          </div>
        ))}
        {error && <p role="alert" style={{ color: "#ff8888" }}>{error}</p>}
        {hasMore && <button type="button" disabled={busy} onClick={loadMore} style={{ background: "#a52222", color: "white", border: 0, borderRadius: 8, padding: "12px 18px", cursor: "pointer" }}>{busy ? "LOADING HISTORY..." : started ? "LOAD MORE TRANSACTIONS" : "LOAD TRANSACTION HISTORY"}</button>}
        {started && !hasMore && <p style={{ color: "#aaa" }}>RPC history exhausted. Older archival records may still exist elsewhere.</p>}
      </div>
    </Section>
  );
}

function CreatorLookup() {
  const [mint, setMint] = useState("");
  const [result, setResult] = useState(null);
  const [creatorEvidence, setCreatorEvidence] = useState(null);
  const [creatorEvidenceDiagnostic, setCreatorEvidenceDiagnostic] = useState("not_requested");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inspection = useRef(null);
  function cancelInspection() { inspection.current?.abort(); inspection.current=null; }
  useEffect(()=>()=>cancelInspection(),[]);
  const [historyCursor, setHistoryCursor] = useState(null);
  const [concentration, setConcentration] = useState(null);
  const [concentrationError, setConcentrationError] = useState("");
  const [holderConnections, setHolderConnections] = useState(null);
  const [holderConnectionsBusy, setHolderConnectionsBusy] = useState(false);
  const [holderConnectionsError, setHolderConnectionsError] = useState("");
  const [workerEvidence,setWorkerEvidence] = useState(null);
  const [verifiedHolderAssessment,setVerifiedHolderAssessment] = useState(null);
  const [frozenHolderObservation,setFrozenHolderObservation]=useState(null);
  const [holderEvidenceState,setHolderEvidenceState] = useState("unknown");
  const holderReconciliation=hasAlignedConcentrationContext(concentration)&&holderConnections
    ?reconcileHolderSnapshot(concentration.accounts||[],holderConnections.holders||[])
    :null;
  const currentHolderConnections=holderReconciliation?.compatible
    ?{...holderConnections,holders:holderReconciliation.holders,
       connectedGroups:(holderConnections.connectedGroups||[]).map(group=>({
         ...group,combinedObservedSharePct:group.members.reduce((sum,wallet)=>sum+
           holderReconciliation.holders.filter(h=>h.ownerWallet===wallet)
             .reduce((n,h)=>n+Number(h.sharePct||0),0),0)
       }))}
    :null;
  // A historical network remains useful even when its holder snapshot differs
  // from live balances. Never substitute current balances into historical nodes.
  const mapHolderConnections=currentHolderConnections||holderConnections;
  const historicalMapOnly=Boolean(holderConnections&&!currentHolderConnections);
  const [currentLiquidity,setCurrentLiquidity]=useState(null);
  const [legacyEvidenceRequested,setLegacyEvidenceRequested]=useState(false);
  const [inspectionTiming,setInspectionTiming]=useState(null);
  const inspectionStartedAt=useRef(null),inspectionMint=useRef('');
  const [currentCreator,setCurrentCreator]=useState(null);
  const [providerUsage,setProviderUsage]=useState({rpcRequests:0,rpcCalls:0,quoteRequests:0,providerHttpRequests:0,marketRequests:0});
  function recordUsage(response,requestMint){
    if(requestMint&&inspectionMint.current!==requestMint)return;
    const n=k=>{const x=Number(response.headers.get(k));return Number.isSafeInteger(x)&&x>=0?x:0;};
    setProviderUsage(p=>({rpcRequests:p.rpcRequests+n('X-Glitch-Rpc-Requests'),rpcCalls:p.rpcCalls+n('X-Glitch-Rpc-Calls'),marketRequests:p.marketRequests+n('X-Glitch-Market-Requests'),quoteRequests:(p.quoteRequests||0)+n('X-Glitch-Quote-Requests'),providerHttpRequests:(p.providerHttpRequests||0)+n('X-Glitch-Provider-Http-Requests')}));
  }
  const [extensions, setExtensions] = useState(null);
  const [extensionsError, setExtensionsError] = useState("");
  const [liquidity, setLiquidity] = useState(null);
  const [liquidityError, setLiquidityError] = useState("");
  const [liquidityRefreshing, setLiquidityRefreshing] = useState(false);
  const liquidityReader=useRef(null);
  if(!liquidityReader.current)liquidityReader.current=createLiquidityReadController({fetchImpl:async(...args)=>{const response=await fetch(...args);recordUsage(response,new URL(args[0],'https://scanner.invalid').searchParams.get('mint'));return response;},publish:state=>{setLiquidity(state.data);setLiquidityError(state.error);setLiquidityRefreshing(state.loading);}});
  useEffect(()=>()=>liquidityReader.current.reset('',true),[]);
  const [poolEvidence, setPoolEvidence] = useState(null);
  const [poolEvidenceError, setPoolEvidenceError] = useState("");
  const [poolEvidenceBusy, setPoolEvidenceBusy] = useState(false);
  const [historyBatches, setHistoryBatches] = useState(0);
  const storedCreatorMatch = creatorEvidence?.creator &&
    ["VERIFIED","ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW"].includes(creatorEvidence.status);
  const storedCreatorLabel = creatorEvidence?.status === "VERIFIED" ? "On-chain confirmed · independently reviewed" :
    "On-chain confirmed · review pending";
  useEffect(() => {
    const address=result?.mint;
    if(!address)return;
    setHolderConnections(null);setHolderConnectionsError("");setHolderConnectionsBusy(true);
    let stopped=false;
    let timer;
    async function refresh(){
      try{
        const response=await fetch("/api/holder-scan-status?mint="+encodeURIComponent(address),{cache:"no-store"});
        if(!response.ok)throw Error("Saved holder intelligence unavailable");
        const data=await response.json();
        if(stopped)return;
        if(data.scan?.mint===address)setHolderConnections({...data.scan,jobId:data.jobId,observedAt:data.scan.updatedAt});
        if(["queued","running"].includes(data.status))timer=setTimeout(refresh,12000);
      }catch{if(!stopped)setHolderConnectionsError("Saved holder intelligence unavailable");}
      finally{if(!stopped)setHolderConnectionsBusy(false);}
    }
    refresh();
    return ()=>{stopped=true;clearTimeout(timer);};
  },[result?.mint]);
  useEffect(() => {
    const address=result?.mint;
    if(!address){setVerifiedHolderAssessment(null);setHolderEvidenceState("unknown");return;}
    let stopped=false;
    let requestSequence=0;
    async function refreshVerified(){
      const sequence=++requestSequence;
      try{
        const response=await fetch("/api/holder-assessment?mint="+encodeURIComponent(address),{cache:"no-store"});
        if(!response.ok)throw Error("HOLDER_EVIDENCE_UNAVAILABLE");
        const data=await response.json();
        if(!stopped&&sequence===requestSequence)setHolderEvidenceState(data.mint===address&&data.assessment?"ready":"unknown");
        if(!stopped&&sequence===requestSequence)setVerifiedHolderAssessment(data.mint===address&&data.assessment?data:null);
      }catch{if(!stopped&&sequence===requestSequence){setHolderEvidenceState("error");setVerifiedHolderAssessment(null);}}
    }
    setVerifiedHolderAssessment(null);
    setHolderEvidenceState("loading");
    refreshVerified();
    const interval=setInterval(refreshVerified,30000);
    return ()=>{stopped=true;requestSequence++;clearInterval(interval);};
  },[result?.mint]);
  useEffect(()=>{
    const address=result?.mint;setFrozenHolderObservation(null);
    if(address!==HOLDER_RETAIN19_POLICY.mint||!legacyEvidenceRequested)return;
    let stopped=false;const controller=new AbortController();
    async function readFrozen(){
      try{
        const response=await fetch('/api/holder-frozen-observation?mint='+encodeURIComponent(address),{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw Error('FROZEN_UNAVAILABLE');
        const data=await response.json();
        // Recompute from exact raw inputs; response diagnostics never promote job evidence.
        const observation=data.mint===address&&data.status==='observed_only'?assessApprovedHolderEligibleConcentration(data.snapshot):null;
        if(stopped||controller.signal.aborted)return;
        if(!stopped)setFrozenHolderObservation(observation);
        // Independent hash validation; never trust serialized API lineage flags.
        const collectionLineage=observation?await verifyHolderCollectionLineage(data.snapshot,{signal:controller.signal}):null;
        if(!stopped&&!controller.signal.aborted)setFrozenHolderObservation(observation?{...observation,collectionLineage}:null);
      }catch{if(!stopped)setFrozenHolderObservation(null);}
    }
    readFrozen();return ()=>{stopped=true;controller.abort();};
  },[result?.mint,legacyEvidenceRequested]);
  useEffect(() => {
    const address=result?.mint;
    setWorkerEvidence(null);
    if(!address)return;
    let stopped=false;
    let controller;
    let sequence=0;
    async function refresh(){
      const request=++sequence;controller?.abort();controller=new AbortController();
      try{
        const data=await readDashboardEvidenceResponse(address,{signal:controller.signal});
        if(!stopped&&request===sequence)setWorkerEvidence(data);
      }catch{if(!stopped&&request===sequence)setWorkerEvidence(null);}
    }
    refresh();
    const interval=setInterval(refresh,30000);
    return ()=>{stopped=true;controller?.abort();clearInterval(interval);};
  },[result?.mint]);
  const poolCandidates=result?.mint&&liquidity?.mint===result.mint?(liquidity.pools||[]).slice(0,2).map(p=>p.pairAddress).filter(Boolean):[];
  const currentPool=poolCandidates[0]||null,alternatePools=poolCandidates.slice(1).join(',');
  useEffect(()=>{
    setCurrentLiquidity(null);if(!result?.mint||!currentPool)return;
    const address=result.mint,controller=new AbortController();let stopped=false;
    const timer=setTimeout(()=>controller.abort(),12000);
    (async()=>{try{
      const response=await fetch('/api/current-liquidity?mint='+encodeURIComponent(address)+'&pool='+encodeURIComponent(currentPool)+'&alternates='+encodeURIComponent(alternatePools),{cache:'no-store',signal:controller.signal});recordUsage(response,address);
      const data=await response.json();if(!stopped&&response.ok&&data.mint===address){setCurrentLiquidity(data.observation||null);if(data.observation&&inspectionStartedAt.current!==null)setInspectionTiming(p=>({...p,liquidityMs:Math.round(performance.now()-inspectionStartedAt.current)}));}
    }catch{}finally{clearTimeout(timer);}})();
    return ()=>{stopped=true;controller.abort();clearTimeout(timer);};
  },[result?.mint,currentPool,alternatePools]);
  useEffect(()=>{
    setCurrentCreator(null);if(!result?.mint)return;
    const address=result.mint,controller=new AbortController();let stopped=false;
    const timer=setTimeout(()=>controller.abort(),12000);
    (async()=>{try{const response=await fetch('/api/current-creator?mint='+encodeURIComponent(address),{cache:'no-store',signal:controller.signal});recordUsage(response,address);const data=await response.json();if(!stopped&&response.ok&&data.version===2&&data.mint===address){setCurrentCreator(data);if(inspectionStartedAt.current!==null)setInspectionTiming(p=>({...p,creatorMs:Math.round(performance.now()-inspectionStartedAt.current)}));}}catch{}finally{clearTimeout(timer);}})();
    return ()=>{stopped=true;controller.abort();clearTimeout(timer);};
  },[result?.mint]);
  const [investigationState,setInvestigationState]=useState(null);
  useEffect(()=>{
    const address=result?.mint;setInvestigationState(null);if(!address||busy)return;
    let stopped=false;const controller=new AbortController();let timer;
    async function run(attempt=0){
      try{
        setInvestigationState({status:'assessment_in_progress'});
        const response=await fetch('/api/token-investigation?mint='+encodeURIComponent(address)+'&run=1',{cache:'no-store',signal:controller.signal});recordUsage(response,address);
        const data=await response.json();if(stopped)return;
        if((response.status===429||data.status==='assessment_in_progress')&&attempt<3){
          const wait=Math.min(20,Math.max(15,Number(response.headers.get('Retry-After'))||15));
          timer=setTimeout(()=>run(attempt+1),wait*1000);return;
        }
        clearTimeout(deadline);setInvestigationState(response.ok?data:{status:response.status===429?'provider_temporarily_unavailable':'evidence_unavailable'});
        if(response.ok&&data.status==='investigation_completed'){
          await Promise.allSettled([
            (async()=>{const evidence=await readDashboardEvidenceResponse(address,{signal:controller.signal});if(!stopped)setWorkerEvidence(evidence);})(),
            (async()=>{const r=await fetch('/api/current-creator?mint='+encodeURIComponent(address),{cache:'no-store',signal:controller.signal});recordUsage(r,address);const c=await r.json();if(!stopped&&r.ok&&c.mint===address&&c.version===2)setCurrentCreator(c);})()
          ]);
        }
      }catch{clearTimeout(deadline);if(!stopped)setInvestigationState({status:'evidence_unavailable'});}
    }
    const deadline=setTimeout(()=>{controller.abort();if(!stopped)setInvestigationState({status:'evidence_unavailable',reason:'bounded_execution_deadline'});},90000);
    timer=setTimeout(()=>run(),1500);
    return ()=>{stopped=true;controller.abort();clearTimeout(timer);clearTimeout(deadline);};
  },[result?.mint,busy]);
  const MAX_HISTORY_BATCHES = 5;
  async function refreshLiquidity(address = mint.trim(), signal) {
    setPoolEvidence(null);setPoolEvidenceError('');
    await liquidityReader.current.read(address,{signal});
  }
  async function verifyPoolAccounts() {
    const addresses = (liquidity?.pools || []).slice(0, 5).map(pool => pool.pairAddress).filter(Boolean);
    if (!addresses.length || poolEvidenceBusy) return;
    setPoolEvidenceBusy(true); setPoolEvidenceError(""); setPoolEvidence(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      let response;
      try {
        response = await fetch("/api/pool-account-evidence", {
          method: "POST", cache: "no-store", signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mint: result?.mint, poolAddresses: addresses })
        });
      } finally { clearTimeout(timeout); }
      const data = await response.json();
      if (!response.ok) throw new Error(data.reason || data.error || "On-chain pool account lookup unavailable");
      if (result?.mint === mint.trim()) setPoolEvidence(data);
    } catch (failure) {
      setPoolEvidenceError(failure.name === "AbortError" ? "Pool account verification timed out" : failure.message);
    } finally { setPoolEvidenceBusy(false); }
  }
  async function inspect(event, cursor = null, historyOnly = false) {
    event.preventDefault();
    if(!historyOnly&&!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint.trim())){setError("Enter a valid Solana token mint address.");return;}
    if(historyOnly&&(busy||historyBatches>=MAX_HISTORY_BATCHES||historyBatches>0&&!historyCursor))return;
    cancelInspection();
    const controller=new AbortController();inspection.current=controller;
    const address=mint.trim(),current=()=>inspection.current===controller;
    let primaryAccepted=historyOnly&&result?.mint===address;
    if(historyOnly&&!primaryAccepted){inspection.current=null;return;}
    let cancel;
    const cancelled=new Promise((_,reject)=>{cancel=()=>reject(Object.assign(Error('Inspection cancelled'),{name:'AbortError'}));controller.signal.addEventListener('abort',cancel,{once:true});});
    // Bound both headers and body, including a non-cooperative late response.
    async function read(path){
      if(controller.signal.aborted)throw Object.assign(Error('Inspection cancelled'),{name:'AbortError'});
      return Promise.race([(async()=>{
        const response=await fetch(path,{cache:'no-store',signal:controller.signal});recordUsage(response,address);
        if(controller.signal.aborted)throw Object.assign(Error('Inspection cancelled'),{name:'AbortError'});
        const data=await response.json();
        if(controller.signal.aborted)throw Object.assign(Error('Inspection cancelled'),{name:'AbortError'});
        if(!response.ok)throw Error('Token evidence unavailable');
        if(data?.mint!==address)throw Error('Token evidence identity mismatch');
        return data;
      })(),cancelled]);
    }
    const timer=setTimeout(()=>controller.abort(),historyOnly?45000:12000);
    setBusy(true); setError(""); if (!historyOnly) { inspectionStartedAt.current=performance.now();inspectionMint.current=address;setInspectionTiming(null);setLegacyEvidenceRequested(false);setProviderUsage({rpcRequests:0,rpcCalls:0,quoteRequests:0,providerHttpRequests:0,marketRequests:0}); liquidityReader.current.reset(address); setResult(null); setCreatorEvidence(null); setCreatorEvidenceDiagnostic("not_requested"); setHistoryCursor(null); setHistoryBatches(0); setConcentration(null); setConcentrationError(""); setExtensions(null); setExtensionsError(""); setLiquidity(null); setLiquidityError(""); setPoolEvidence(null); setPoolEvidenceError(""); }
    if(historyOnly){setHistoryBatches(n=>n+1);setHistoryCursor(null);}
    try {
      const data=await read(historyOnly?'/api/creator?mint='+encodeURIComponent(address)+'&mode=history'+(cursor?'&before='+encodeURIComponent(cursor):''):'/api/token-current?mint='+encodeURIComponent(address));
      if(!current())return;
      if(historyOnly){
        if(data.inspectionMode!=="history")throw Error('Historical evidence contract mismatch');
        const historicalFields=['creatorEvidence','pumpLaunchEvidence','launchpadEvidence','launchInvestigation','stonkFunEvidence','creator','solscanDiagnostic','mintOrigin','indexedHistoryDiagnostic','historicalProvider','creatorHoldingTime'];
        const history=Object.fromEntries(historicalFields.filter(key=>Object.hasOwn(data,key)).map(key=>[key,data[key]]));
        setResult(previous=>previous?.mint===address?{...previous,...history}:previous);
        setHistoryCursor(data.mintOrigin?.coverage?.nextCursor || null);
        return;
      }
      setResult(data);primaryAccepted=true;if(inspectionStartedAt.current!==null)setInspectionTiming({firstEvidenceMs:Math.round(performance.now()-inspectionStartedAt.current)});if(data.currentExtensions)setExtensions(data.currentExtensions);
      setHistoryCursor(data.mintOrigin?.coverage?.nextCursor || null);
      // Independent sources publish as soon as each returns. A failed market
      // provider cannot erase current mint controls or persisted evidence.
      const tasks=[
       (async()=>{try{const record=await read('/api/creator-evidence?mint='+encodeURIComponent(address));if(current()){setCreatorEvidence(record);setCreatorEvidenceDiagnostic(record.status==='VERIFIED'?'record_available':'record_not_established');}}catch{if(current())setCreatorEvidenceDiagnostic('lookup_failed');}})(),
       address==='98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump'?Promise.resolve():(async()=>{try{const accountData=await read('/api/token-concentration?mint='+encodeURIComponent(address));if(current())setConcentration(withConcentrationContext(accountData));}catch{if(current())setConcentrationError('Token-account balances unavailable');}})(),
       data.tokenProgram==='spl-token-2022'&&(!data.currentExtensions||data.currentExtensions.transferFee?.status==='observed'&&(!data.currentExtensions.transferFee.configAuthorityReported||data.currentExtensions.transferFee.configAuthority===null&&!data.currentExtensions.transferFee.effectiveFee))?(async()=>{try{const e=await read('/api/token-extensions?mint='+encodeURIComponent(address));if(current())setExtensions(e);}catch{if(current())setExtensionsError('Extension data unavailable');}})():Promise.resolve(),
       Promise.race([refreshLiquidity(address,controller.signal),cancelled])
      ];
      await Promise.allSettled(tasks);
      if(!current()||controller.signal.aborted)return;

    } catch (failure) { if(current()){if(!primaryAccepted)setResult(null);setError(primaryAccepted?"Additional evidence unavailable or timed out. Current mint observation retained; unresolved attributes remain Unknown.":failure.name === "AbortError" ? "Token inspection timed out. Evidence remains incomplete; no automatic retry was made." : "Token inspection unavailable or mismatched. Evidence remains Unknown.");} }
    finally { clearTimeout(timer);controller.signal.removeEventListener('abort',cancel);if(current()){inspection.current=null;setBusy(false);if(!historyOnly&&inspectionStartedAt.current!==null)setInspectionTiming(p=>({...p,initialSourcesMs:Math.round(performance.now()-inspectionStartedAt.current)}));} }
  }
  return <section aria-label="GLITCH Scanner Token Analysis" className="doom-token-inspect" style={{ ...cardStyle, border: "none", boxShadow: "none" }}>
    <div className="scanner-console">
    <p className="doom-token-intro"><b aria-hidden="true">//</b> GLITCH Scanner <span>· Inspect a Solana token</span></p>
    <form onSubmit={inspect} className="scanner-form">
      <div className="scanner-input"><svg aria-hidden="true" viewBox="0 0 40 36" width="40" height="36"><defs><linearGradient id="solana" x2="1" y2="1"><stop stopColor="#00ffbd"/><stop offset=".5" stopColor="#37baff"/><stop offset="1" stopColor="#df2dff"/></linearGradient></defs><path fill="url(#solana)" d="M8 2h30l-8 8H0zm-8 13h30l8 8H8zm8 13h30l-8 8H0z"/></svg>
      <input aria-label="Solana token mint address" value={mint} onChange={e => {cancelInspection();setBusy(false);setError("");setResult(null);liquidityReader.current.reset(e.target.value.trim());setMint(e.target.value);}} placeholder="Paste Solana token mint address" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="go" required />
      <button type="button" className="scanner-paste" aria-label="Paste token mint address" onClick={async()=>{try{const text=await navigator.clipboard.readText();cancelInspection();setBusy(false);setResult(null);liquidityReader.current.reset(text.trim());setMint(text.trim());setError("");}catch{setError("Clipboard unavailable. Touch and hold the address field to paste.");}}}>Paste</button></div>
      <button className="scanner-submit" type="submit" disabled={busy}>{busy ? "INSPECTING..." : "INSPECT TOKEN"}</button>
    </form></div>
    {error && <p role="alert" style={{ color: "#ff9999" }}>{error}</p>}
    {busy && <p role="status" style={{ color: "#ddd" }}>Scanning Solana · Reading token evidence…</p>}

    {result && <div tabIndex={-1} ref={node=>{if(node&&node.dataset.mint!==result.mint){node.dataset.mint=result.mint;node.scrollIntoView({behavior:"instant",block:"start"});node.focus({preventScroll:true});}}} className="doom-results" style={{ marginTop: 16, overflowWrap: "anywhere", lineHeight: 1.8 }}>
      {investigationState&&<p role="status">{({assessment_in_progress:'Assessment in progress · bounded evidence investigation',investigation_completed:'Investigation completed · available evidence refreshed',evidence_unavailable:'Evidence unavailable · bounded investigation stopped',provider_temporarily_unavailable:'Provider temporarily unavailable · current assessment retained',unsupported_protocol:'Unsupported protocol'})[investigationState.status]||'Evidence available'}</p>}
      <GlitchV11Dashboard key={result.mint} result={result} extensions={extensions} concentration={concentration} creatorEvidence={creatorEvidence} liquidity={liquidity} liquidityError={liquidityError} liquidityRefreshing={liquidityRefreshing} historicalHolders={holderConnections} holderSnapshotCompatible={holderReconciliation?.compatible===true} verifiedHolderEnvelope={verifiedHolderAssessment} holderEvidenceState={holderEvidenceState} frozenHolderObservation={frozenHolderObservation} workerEvidence={workerEvidence} currentLiquidity={currentLiquidity} currentCreator={currentCreator} providerUsage={providerUsage} inspectionTiming={inspectionTiming} onRequestLegacyEvidence={()=>setLegacyEvidenceRequested(true)}><details className="doom-token-tools"><summary>Optional creator history investigation</summary><button type="button" disabled={busy||historyBatches>=MAX_HISTORY_BATCHES||historyBatches>0&&!historyCursor} onClick={event=>inspect(event,historyCursor,true)} style={{padding:10,background:"#281a20",color:"white",border:"1px solid #76424a",borderRadius:8}}> {historyBatches===0?"Investigate creator history":historyCursor?"Continue creator history":"Historical investigation stopped"} </button></details></GlitchV11Dashboard>

      {/* Previous token evidence panels retired from the layout; raw data and scan workers remain unchanged. */}
    </div>}
  </section>;
}

export default function Home() {
  return <main className="scanner-home">
    <header className="scanner-brand"><strong><i aria-hidden="true">//</i> DOOM404</strong><span>— INTELLIGENCE SYSTEM —</span></header>
    <div className="scanner-heading"><h1><span>GLITCH</span> Scanner</h1><p>On-chain risk intelligence for Solana tokens.</p></div>
    <picture className="scanner-scene"><source media="(max-width: 640px)" srcSet="/scanner-scene-750.webp"/><img src="/scanner-scene-1254.webp" alt="DOOM404 red-hood mascot scanning a holographic Solana symbol, surrounded by trading and security panels" width="1254" height="371" fetchPriority="high"/></picture>
    <CreatorLookup />
  </main>;
}
