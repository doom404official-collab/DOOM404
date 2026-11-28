"use client";
import {saveReport, loadReport, updateReport} from "../lib/completedReport.mjs";
import {runStagedTokenScan} from '../lib/stagedTokenScan.mjs';
import {scanRequestTiming,scannerFailureMessage} from '../lib/scanTiming.mjs';
import {withConcentrationContext,hasAlignedConcentrationContext} from "../lib/concentrationContext.mjs";

import { useEffect, useRef, useState } from "react";
import {readDashboardEvidenceResponse} from '../lib/dashboardEvidenceRead.mjs';
import {createLiquidityReadController} from '../lib/liquidityReadController.mjs';
import HolderBubbleMap from "./HolderBubbleMap";
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
        {hasMore && <button type="button" disabled={busy||savingReport} onClick={() => loadPages(false)} style={{ background: "#a52222", color: "white", border: 0, borderRadius: 8, padding: "12px 18px" }}>{busy ? "DECODING..." : started ? "ANALYZE NEXT 20 TRANSACTIONS" : "RUN DEEP ANALYSIS"}</button>}
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
        {hasMore && <button type="button" disabled={busy||savingReport} onClick={loadMore} style={{ background: "#a52222", color: "white", border: 0, borderRadius: 8, padding: "12px 18px", cursor: "pointer" }}>{busy ? "LOADING HISTORY..." : started ? "LOAD MORE TRANSACTIONS" : "LOAD TRANSACTION HISTORY"}</button>}
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
  const providerUsageRef=useRef({rpcRequests:0,rpcCalls:0,quoteRequests:0,providerHttpRequests:0,marketRequests:0}),requestTimings=useRef([]);
  const [providerUsage,setProviderUsage]=useState({rpcRequests:0,rpcCalls:0,quoteRequests:0,providerHttpRequests:0,marketRequests:0});
  function recordUsage(response,requestMint){
    if(requestMint&&inspectionMint.current!==requestMint)return;
    const n=k=>{const x=Number(response.headers.get(k));return Number.isSafeInteger(x)&&x>=0?x:0;};
    const p=providerUsageRef.current;providerUsageRef.current={rpcRequests:p.rpcRequests+n('X-Glitch-Rpc-Requests'),rpcCalls:p.rpcCalls+n('X-Glitch-Rpc-Calls'),marketRequests:p.marketRequests+n('X-Glitch-Market-Requests'),quoteRequests:(p.quoteRequests||0)+n('X-Glitch-Quote-Requests'),providerHttpRequests:(p.providerHttpRequests||0)+n('X-Glitch-Provider-Http-Requests')};setProviderUsage(providerUsageRef.current);
  }
  const [extensions, setExtensions] = useState(null);
  const [extensionsError, setExtensionsError] = useState("");
  const [liquidity, setLiquidity] = useState(null);
  const [liquidityError, setLiquidityError] = useState("");
  const [liquidityRefreshing, setLiquidityRefreshing] = useState(false);
  const liquiditySnapshot=useRef(null);
  const liquidityReader=useRef(null);
  if(!liquidityReader.current)liquidityReader.current=createLiquidityReadController({fetchImpl:async(...args)=>{const response=await fetch(...args);recordUsage(response,new URL(args[0],'https://scanner.invalid').searchParams.get('mint'));return response;},publish:state=>{liquiditySnapshot.current=state.data;setLiquidity(state.data);setLiquidityError(state.error);setLiquidityRefreshing(state.loading);}});
  useEffect(()=>()=>liquidityReader.current.reset('',true),[]);
  const [poolEvidence, setPoolEvidence] = useState(null);
  const [poolEvidenceError, setPoolEvidenceError] = useState("");
  const [poolEvidenceBusy, setPoolEvidenceBusy] = useState(false);
  const [historyBatches, setHistoryBatches] = useState(0);
  const storedCreatorMatch = creatorEvidence?.creator &&
    ["VERIFIED","ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW"].includes(creatorEvidence.status);
  const storedCreatorLabel = creatorEvidence?.status === "VERIFIED" ? "On-chain confirmed · independently reviewed" :
    "On-chain confirmed · review pending";
  const [investigationState,setInvestigationState]=useState(null);
  const [scanStatus,setScanStatus]=useState('');
  const [reportUrl,setReportUrl]=useState('');
  const [savingReport,setSavingReport]=useState(false);
  const scanLock=useRef(false);
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
    if(scanLock.current||savingReport)return;
    if(!historyOnly&&!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint.trim())){setError("Enter a valid Solana token mint address.");return;}
    if(historyOnly&&(busy||historyBatches>=MAX_HISTORY_BATCHES||historyBatches>0&&!historyCursor))return;
    scanLock.current=true;setReportUrl('');
    cancelInspection();
    const controller=new AbortController();inspection.current=controller;
    const address=mint.trim(),current=()=>inspection.current===controller;
    let primaryAccepted=historyOnly&&result?.mint===address;
    if(historyOnly&&!primaryAccepted){inspection.current=null;return;}
    let cancel;
    const cancelled=new Promise((_,reject)=>{cancel=()=>reject(Object.assign(Error('Inspection cancelled'),{name:'AbortError'}));controller.signal.addEventListener('abort',cancel,{once:true});});
    let lastSnapshot=null,activeReportId=null,persistQueue=Promise.resolve();
    // Bound both headers and body, including a non-cooperative late response.
    async function read(path,{signal:stageSignal}={}){
      if(controller.signal.aborted)throw Object.assign(Error('Inspection cancelled'),{name:'AbortError'});
      return Promise.race([(async()=>{
        const startedAt=performance.now(),response=await fetch(path,{cache:'no-store',signal:stageSignal?AbortSignal.any([controller.signal,stageSignal]):controller.signal}),headersAt=performance.now();recordUsage(response,address);
        if(controller.signal.aborted)throw Object.assign(Error('Inspection cancelled'),{name:'AbortError'});
        const data=await response.json();
        if(current())requestTimings.current.push(scanRequestTiming({path,startedAt,headersAt,finishedAt:performance.now(),response}));
        if(controller.signal.aborted)throw Object.assign(Error('Inspection cancelled'),{name:'AbortError'});
        if(!response.ok){const failure=Error('Token evidence unavailable');failure.code=data?.error||data?.reason;failure.status=response.status;failure.retryAfterSeconds=Number(response.headers.get('Retry-After'));throw failure;}
        if(data?.mint!==address)throw Error('Token evidence identity mismatch');
        return data;
      })(),cancelled]);
    }
    const timer=setTimeout(()=>controller.abort(),historyOnly?45000:65000);
    setScanStatus("Checking token security.");
    setBusy(true); setError(""); if (!historyOnly) { inspectionStartedAt.current=performance.now();inspectionMint.current=address;setInspectionTiming(null);setLegacyEvidenceRequested(false);setCurrentLiquidity(null);setCurrentCreator(null);setWorkerEvidence(null);setHolderConnections(null);setVerifiedHolderAssessment(null);setInvestigationState(null);providerUsageRef.current={rpcRequests:0,rpcCalls:0,quoteRequests:0,providerHttpRequests:0,marketRequests:0};requestTimings.current=[];setProviderUsage(providerUsageRef.current); liquidityReader.current.reset(address); setResult(null); setCreatorEvidence(null); setCreatorEvidenceDiagnostic("not_requested"); setHistoryCursor(null); setHistoryBatches(0); setConcentration(null); setConcentrationError(""); setExtensions(null); setExtensionsError(""); setLiquidity(null); setLiquidityError(""); setPoolEvidence(null); setPoolEvidenceError(""); }
    if(historyOnly){setHistoryBatches(n=>n+1);setHistoryCursor(null);}
    try {
      if(historyOnly){
        const data=await read('/api/creator?mint='+encodeURIComponent(address)+'&mode=history'+(cursor?'&before='+encodeURIComponent(cursor):''));
        if(!current())return;
        if(data.inspectionMode!=="history")throw Error('Historical evidence contract mismatch');
        const historicalFields=['creatorEvidence','pumpLaunchEvidence','launchpadEvidence','launchInvestigation','stonkFunEvidence','creator','solscanDiagnostic','mintOrigin','indexedHistoryDiagnostic','historicalProvider','creatorHoldingTime'];
        const history=Object.fromEntries(historicalFields.filter(key=>Object.hasOwn(data,key)).map(key=>[key,data[key]]));
        setResult(previous=>previous?.mint===address?{...previous,...history}:previous);
        setHistoryCursor(data.mintOrigin?.coverage?.nextCursor || null);return;
      }
      const buildProps=snapshot=>({...snapshot,concentration:snapshot.concentration?withConcentrationContext(snapshot.concentration):null,
        liquidityRefreshing:false,liquidityError:snapshot.liquidity?'':'Current market discovery unavailable or still in progress.',
        frozenHolderObservation,holderSnapshotCompatible:false,providerUsage:{...providerUsageRef.current},
        inspectionTiming:{...snapshot.inspectionTiming,requests:[...requestTimings.current]},
        investigationProgress:{...snapshot.investigationProgress,expiresAt:new Date(Date.now()+70000).toISOString()}});
      const apply=snapshot=>{
        if(!current())return;const firstMint=snapshot.result&&!lastSnapshot?.result;lastSnapshot=snapshot;
        if(firstMint)setScanStatus(snapshot.result.mintAuthority?'Active mint authority observed; other checks continue.':snapshot.result.freezeAuthority?'Active freeze authority observed; other checks continue.':'Mint and freeze authorities revoked; other checks continue.');
        if(snapshot.result){primaryAccepted=true;setResult(snapshot.result);}
        setExtensions(snapshot.extensions);if(snapshot.concentration){const accountData=snapshot.concentration;setConcentration(withConcentrationContext(accountData));}
        setCreatorEvidence(snapshot.creatorEvidence);setLiquidity(snapshot.liquidity);liquiditySnapshot.current=snapshot.liquidity;
        setCurrentLiquidity(snapshot.currentLiquidity);setCurrentCreator(snapshot.currentCreator);setWorkerEvidence(snapshot.workerEvidence);
        setHolderConnections(snapshot.historicalHolders);setVerifiedHolderAssessment(snapshot.verifiedHolderEnvelope);setHolderEvidenceState(snapshot.holderEvidenceState);
        setInvestigationState(snapshot.investigationState||snapshot.investigationProgress);setInspectionTiming(snapshot.inspectionTiming);
        if(activeReportId){const props=buildProps(snapshot);persistQueue=persistQueue.catch(()=>{}).then(()=>current()?updateReport(activeReportId,props):null);}
      };
      await runStagedTokenScan({mint:address,read,signal:controller.signal,onUpdate:apply,onInitial:async snapshot=>{
        if(!current())return;apply(snapshot);setSavingReport(true);
        const id=await saveReport(buildProps(snapshot));if(!current())return;
        activeReportId=id;const url='/?report='+encodeURIComponent(id);setReportUrl(url);setBusy(false);scanLock.current=false;setSavingReport(false);setScanStatus('Bounded intelligence investigation continues.');
        try{window.open(url,'_blank','noopener,noreferrer');}catch{}
      }});
      await persistQueue;
      if(current())setScanStatus('');

    } catch (failure) { if(current()){if(activeReportId&&lastSnapshot){await persistQueue.catch(()=>{});try{await updateReport(activeReportId,{...lastSnapshot,providerUsage:{...providerUsageRef.current},inspectionTiming:{...lastSnapshot.inspectionTiming,requests:[...requestTimings.current]},investigationProgress:{...lastSnapshot.investigationProgress,stage:'bounded_stopped',reason:failure.name==='AbortError'?'time_limit':'evidence_unavailable'}});}catch{}}if(!primaryAccepted)setResult(null);if(primaryAccepted)setScanStatus('');setError(scannerFailureMessage({code:failure.code,retryAfterSeconds:failure.retryAfterSeconds,primaryAccepted,cancelled:failure.name==="AbortError"}));} }
    finally { clearTimeout(timer);controller.signal.removeEventListener('abort',cancel);controller.abort();if(current()){inspection.current=null;scanLock.current=false;setBusy(false);if(!historyOnly&&inspectionStartedAt.current!==null)setInspectionTiming(p=>({...p,boundedReportMs:Math.round(performance.now()-inspectionStartedAt.current)}));setSavingReport(false);} }
  }
  return <section aria-label="GLITCH Scanner Token Analysis" className="doom-token-inspect" style={{ ...cardStyle, border: "none", boxShadow: "none" }}>
    <div className="scanner-console">
    <h2 className="doom-token-intro">Inspect a Solana token</h2>
    <form onSubmit={inspect} className="scanner-form">
      <div className="scanner-input"><svg aria-hidden="true" viewBox="0 0 40 36" width="40" height="36"><defs><linearGradient id="solana" x2="1" y2="1"><stop stopColor="#00ffbd"/><stop offset=".5" stopColor="#37baff"/><stop offset="1" stopColor="#df2dff"/></linearGradient></defs><path fill="url(#solana)" d="M8 2h30l-8 8H0zm-8 13h30l8 8H8zm8 13h30l-8 8H0z"/></svg>
      <input aria-label="Solana token mint address" value={mint} onChange={e => {cancelInspection();setBusy(false);setError("");setResult(null);liquidityReader.current.reset(e.target.value.trim());setMint(e.target.value);}} placeholder="Paste token mint address" disabled={busy||savingReport} autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="go" required />
      <button type="button" className="scanner-paste" disabled={busy||savingReport} aria-label="Paste token mint address" onClick={async()=>{try{const text=await navigator.clipboard.readText();cancelInspection();setBusy(false);setResult(null);liquidityReader.current.reset(text.trim());setMint(text.trim());setError("");}catch{setError("Clipboard unavailable. Touch and hold the address field to paste.");}}}>Paste</button></div>
      <button className="scanner-submit" type="submit" disabled={busy||savingReport}>{busy ? "INSPECTING..." : "INSPECT TOKEN"}</button>
      <div className="scanner-status-slot">
      {(busy||savingReport)&&<div className="scanner-progress" role="status" aria-live="polite"><strong>ANALYSING TOKEN...</strong><div className="scanner-track"><i /></div><span data-first-evidence={!!result}>{savingReport?"Saving intelligence report.":scanStatus}</span></div>}
      {reportUrl&&!savingReport&&<a className="scanner-report-link" href={reportUrl} target="_blank" rel="noopener noreferrer">VIEW INTELLIGENCE REPORT</a>}
      {error && <p className="scanner-error" role="alert">{error}</p>}
      </div>
    </form></div>


  </section>;
}

function CompletedReport({id}) {
  const [report,setReport]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let active=true,timer,seenRevision;const started=Date.now();
    const read=async()=>{try{const data=await loadReport(id);if(!active)return;if(!data){setError('This report is unavailable in this browser. Return to the scanner to create a report.');return;}
      const progressing=['initial_in_progress','deep_in_progress'].includes(data.investigationProgress?.stage),expired=Date.parse(data.investigationProgress?.expiresAt)<=Date.now()||Date.now()-started>=75000;
      if(seenRevision!==data.evidenceRevision||seenRevision===undefined||expired){setReport(progressing&&expired?{...data,investigationProgress:{...data.investigationProgress,stage:'bounded_stopped',reason:'updates_expired'}}:data);seenRevision=data.evidenceRevision;}
      if(progressing&&!expired)timer=setTimeout(read,1000);
    }catch{if(active)setError('Unable to read this saved report.');}};read();return()=>{active=false;clearTimeout(timer);};},[id]);
  return <main className="scanner-home">{error?<p role="alert">{error}</p>:report?<GlitchV11Dashboard key={id} {...report} />:<p role="status">Loading saved intelligence report…</p>}</main>;
}
export default function Home() {
  const [reportId,setReportId]=useState(undefined);
  useEffect(()=>setReportId(new URLSearchParams(window.location.search).get('report')),[]);
  if(reportId===undefined)return null;
  if(reportId)return <CompletedReport id={reportId}/>;
  return <main className="scanner-home scanner-landing">
    <header className="scanner-brand"><strong><i aria-hidden="true">//</i> DOOM404</strong><span>— INTELLIGENCE SYSTEM —</span></header>
    <div className="scanner-heading"><h1><span>GLITCH</span> Scanner</h1><p>On-chain risk intelligence for Solana tokens.</p></div>
    <div className="scanner-scene"><picture><source media="(max-width: 640px)" srcSet="/scanner-scene-750.webp"/><img src="/scanner-scene-1254.webp" alt="DOOM404 red-hood mascot scanning a holographic Solana symbol, surrounded by trading and security panels" width="1254" height="371" fetchPriority="high"/></picture><div className="scanner-hologram" aria-hidden="true"><i className="hologram-ring"/><i className="hologram-energy"/></div></div>
    <CreatorLookup />
  </main>;
}
