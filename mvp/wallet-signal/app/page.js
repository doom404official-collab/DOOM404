"use client";

import { useEffect, useRef, useState } from "react";
import HolderBubbleMap from "./HolderBubbleMap";
import {reconcileHolderSnapshot} from "../lib/reconcileHolderSnapshot.mjs";
import {scoreHolderConcentration} from "../lib/holderConcentrationScore.mjs";
import { assessGlitchEvidence } from "../lib/glitchRiskIndicators.js";
import { selectTokenInsights } from "../lib/tokenInsights.js";
import { assessTokenEvidence } from "../lib/tokenAssessment.js";
import { assessTokenControls } from "../lib/tokenControlsAssessment.mjs";
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
  const [historyCursor, setHistoryCursor] = useState(null);
  const [concentration, setConcentration] = useState(null);
  const [concentrationError, setConcentrationError] = useState("");
  const [holderConnections, setHolderConnections] = useState(null);
  const [holderConnectionsBusy, setHolderConnectionsBusy] = useState(false);
  const [holderConnectionsError, setHolderConnectionsError] = useState("");
  const holderReconciliation=concentration&&holderConnections
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
  const [extensions, setExtensions] = useState(null);
  const [extensionsError, setExtensionsError] = useState("");
  const [liquidity, setLiquidity] = useState(null);
  const [liquidityError, setLiquidityError] = useState("");
  const [liquidityRefreshing, setLiquidityRefreshing] = useState(false);
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
    let stopped=false;
    let timer;
    async function refresh(){
      try{
        const response=await fetch("/api/holder-scan-status?mint="+encodeURIComponent(address),{cache:"no-store"});
        if(!response.ok)return;
        const data=await response.json();
        if(stopped)return;
        if(data.scan?.mint===address)setHolderConnections({...data.scan,observedAt:data.scan.updatedAt});
        if(["not_started","queued","running","partial"].includes(data.status))timer=setTimeout(refresh,12000);
      }catch{/* Retain last verified result rather than replacing it with an error. */}
    }
    refresh();
    return ()=>{stopped=true;clearTimeout(timer);};
  },[result?.mint]);
  const MAX_HISTORY_BATCHES = 5;
  async function refreshLiquidity(address = mint.trim()) {
    if (!address || liquidityRefreshing) return;
    setLiquidityRefreshing(true);
    setLiquidityError("");
    setPoolEvidence(null); setPoolEvidenceError("");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      let response;
      try {
        response = await fetch("/api/token-liquidity?mint=" + encodeURIComponent(address), { cache: "no-store", signal: controller.signal });
      } finally { clearTimeout(timeout); }
      const data = await response.json();
      if (!response.ok) throw new Error(data.reason || "Liquidity data unavailable");
      if (address === mint.trim()) setLiquidity(data);
    } catch (failure) {
      setLiquidityError(failure.name === "AbortError" ? "Liquidity refresh timed out" : failure.message);
    } finally { setLiquidityRefreshing(false); }
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
  async function inspect(event, cursor = null) {
    event.preventDefault();
    setBusy(true); setError(""); if (!cursor) { setResult(null); setCreatorEvidence(null); setCreatorEvidenceDiagnostic("not_requested"); setHistoryCursor(null); setHistoryBatches(0); setConcentration(null); setConcentrationError(""); setExtensions(null); setExtensionsError(""); setLiquidity(null); setLiquidityError(""); setPoolEvidence(null); setPoolEvidenceError(""); }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      let response;
      try { response = await fetch("/api/creator?mint=" + encodeURIComponent(mint.trim()) + (cursor ? "&before=" + encodeURIComponent(cursor) : ""), { cache: "no-store", signal: controller.signal }); }
      finally { clearTimeout(timer); }
      const data = await response.json();
      if (!response.ok) throw new Error([data.error, data.detail].filter(Boolean).join(" " ) || "Token lookup failed");
      setResult(data);
      if (!cursor) {
        try {
          const evidenceResponse = await fetch("/api/creator-evidence?mint=" + encodeURIComponent(mint.trim()), { cache: "no-store" });
          if (evidenceResponse.ok) {
            const record = await evidenceResponse.json();
            setCreatorEvidence(record);
            setCreatorEvidenceDiagnostic(record?.creator && ["VERIFIED","ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW"].includes(record.status) ? "record_available" : record?.status === "INDEXED_UNVERIFIED" ? "indexed_candidate" : record?.status === "CACHE_MISS" ? "cache_miss" : record?.status === "EVIDENCE_INCOMPLETE" ? "evidence_incomplete" : record?.status === "CONFLICT" ? "evidence_conflict" : "record_not_established");
          } else {
            setCreatorEvidenceDiagnostic(evidenceResponse.status === 503 ? "vault_unavailable" : "lookup_failed");
          }
        } catch { setCreatorEvidenceDiagnostic("network_failure"); }
      }
      if (!cursor) {
        try {
          const concentrationResponse = await fetch("/api/token-concentration?mint=" + encodeURIComponent(mint.trim()), { cache: "no-store" });
          const accountData = await concentrationResponse.json();
          if (!concentrationResponse.ok) throw new Error(accountData.error || "Token-account balances unavailable");
          setConcentration(accountData);
          setHolderConnections(null);
          setHolderConnectionsError("");
          setHolderConnectionsBusy(true);
          // Read existing persisted intelligence; never launch an expensive
          // synchronous two-transaction scan as a substitute for deep history.
          fetch("/api/holder-scan-status?mint="+encodeURIComponent(mint.trim()),{cache:"no-store"})
            .then(async response=>{const payload=await response.json();if(!response.ok)throw Error(payload.error||"Saved holder intelligence unavailable");return payload;})
            .then(payload=>{if(payload.scan)setHolderConnections({...payload.scan,observedAt:payload.scan.updatedAt});})
            .catch(e=>setHolderConnectionsError(e.message))
            .finally(()=>setHolderConnectionsBusy(false));
        } catch (concentrationFailure) { setConcentrationError(concentrationFailure.message); }
      }
      if (!cursor && data.tokenProgram === "spl-token-2022") {
        try {
          const extensionResponse = await fetch("/api/token-extensions?mint=" + encodeURIComponent(mint.trim()), { cache: "no-store" });
          const extensionData = await extensionResponse.json();
          if (!extensionResponse.ok) throw new Error(extensionData.error || "Extension data unavailable");
          setExtensions(extensionData);
        } catch (extensionFailure) { setExtensionsError(extensionFailure.message); }
      }
      if (!cursor) await refreshLiquidity(mint.trim());
      setHistoryCursor(data.mintOrigin?.coverage?.nextCursor || null);
      setHistoryBatches(n => cursor ? n + 1 : 1);
    } catch (failure) { setError(failure.name === "AbortError" ? "Historical scan timed out after 45 seconds. Retry the same batch or use an archival data provider." : failure.message); }
    finally { setBusy(false); }
  }
  return <section aria-label="Creator Intelligence" style={{ ...cardStyle, borderColor: "#633" }}>
    <p style={{ color: "#ff7777", fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>DOOM404 // CREATOR INTELLIGENCE · CB-01</p>
    <h2 style={{ marginTop: 8 }}>Inspect a Solana token</h2>
    <p style={{ color: "#bbb", lineHeight: 1.6 }}>First verify the token mint. Historical creator identification and holding-time analytics are under development.</p>
    <form onSubmit={inspect} style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <input aria-label="Solana token mint address" value={mint} onChange={e => setMint(e.target.value)} placeholder="Paste Solana token mint address" required style={{ flex: "1 1 260px", minWidth: 0, padding: 12, background: "#101010", border: "1px solid #555", borderRadius: 8, color: "white" }} />
      <button type="submit" disabled={busy} style={{ padding: "12px 18px", border: 0, borderRadius: 8, background: "#a52222", color: "white", cursor: "pointer" }}>{busy ? "INSPECTING..." : "INSPECT TOKEN"}</button>
    </form>
    {error && <p role="alert" style={{ color: "#ff9999" }}>{error}</p>}
    {busy && <p role="status" style={{ color: "#ddd" }}>Querying Solana history. Each batch checks up to 3,000 signatures; this may take up to 45 seconds.</p>}
    {result && <div aria-live="polite" style={{ marginTop: 16, overflowWrap: "anywhere", lineHeight: 1.8 }}>
      {creatorEvidence && ["VERIFIED", "ONCHAIN_MATCH_PENDING_INDEPENDENT_REVIEW"].includes(creatorEvidence.status) && creatorEvidence.creator && (
        <div style={{ ...cardStyle, borderColor: "#365c45" }}>
          <h3>Creator attribution evidence</h3>
          <p><strong>Wallet:</strong> <AddressLink address={creatorEvidence.creator} /></p>
          <p><strong>Status:</strong> {creatorEvidence.status === "VERIFIED" ? "Independently reviewed" : "On-chain match — independent review pending"}</p>
          {creatorEvidence.evidence?.[0]?.signature && <p><a href={"https://solscan.io/tx/" + encodeURIComponent(creatorEvidence.evidence[0].signature)} target="_blank" rel="noopener noreferrer">View creation transaction</a></p>}
          <p style={{ color: "#999", fontSize: 12 }}>A wallet attribution is not proof of beneficial ownership or project legitimacy.</p>
        </div>
      )}
      {(() => {
        const summary = buildDecisionSummary({result,extensions,concentration,liquidity,creatorEvidence});
        return <div style={{ ...cardStyle, borderColor:"#59433b", marginBottom:16 }}>
          <p style={{fontSize:12,letterSpacing:2,color:"#ff8585",fontWeight:700}}>GLITCH // DECISION INTELLIGENCE</p>
          <h2 style={{margin:"8px 0"}}>{summary.title}</h2>
          <p style={{color:"#ddd",lineHeight:1.6}}>{summary.explanation}</p>
          <p style={{color:"#aaa",fontSize:12}}>Evidence coverage: {summary.coverageCount}/{summary.coverageTotal} categories · Creator verification is not required for token-only findings · Not an investment recommendation</p>
          <h3>Top 3 findings — what matters now</h3>
          {summary.findings.map((item,index)=><div key={index} style={{padding:"12px 0",borderTop:"1px solid #333"}}>
            <strong>{index+1}. {item.title}</strong>
            <p style={{color:"#ccc",margin:"6px 0"}}>{item.detail}</p>
            <small style={{color:"#999"}}>Evidence: {item.source}</small>
          </div>)}
        </div>;
      })()}
      <Section title="TOKEN SECURITY OVERVIEW" defaultOpen={true}>
        <p style={{ color: "#ff8585", letterSpacing: 2, fontSize: 12, fontWeight: 700, marginTop: 0 }}>GLITCH // TOKEN SECURITY OVERVIEW</p>
        <h3 style={{ margin: "0 0 8px" }}>Observed signals, not a safety rating</h3>
        <p style={{ color: "#aaa", fontSize: 13 }}>Evidence coverage: {concentration ? "account concentration available" : "account concentration pending or unavailable"} · {extensions?.verified ? "Token-2022 mint extensions parsed" : result.tokenProgram === "spl-token-2022" ? "Token-2022 extensions pending or unavailable" : "Token-2022 extensions not applicable"}</p>
        <style>{`
          .doom-token-signal-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
          @media (min-width: 780px) { .doom-token-signal-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
          .doom-token-signal-grid > div { min-width:0; }
        `}</style>
        <div className="doom-token-signal-grid">
          {[
            { label: "Transfer fee schedules", value: extensions?.transferFee?.olderFee && extensions?.transferFee?.newerFee ? extensions.transferFee.olderFee.percentage + "% / " + extensions.transferFee.newerFee.percentage + "%" : extensions?.transferFee?.status === "observed" ? "Present · rate unknown" : extensions?.verified ? "Not observed" : "Not assessed" },
            { label: "Fee configuration authority", value: extensions?.transferFee?.configAuthorityReported ? (extensions.transferFee.configAuthority ? "Present" : "Revoked") : "Not verified" },
            { label: "Mint authority", value: result.authorityDetailsStatus === "not_parsed" ? "Not verified" : result.mintAuthority ? "Present" : "None" },
            { label: "Freeze authority", value: result.authorityDetailsStatus === "not_parsed" ? "Not verified" : result.freezeAuthority ? "Present" : "None" },
            { label: "Largest token account", value: concentration?.largestAccountSharePct != null ? concentration.largestAccountSharePct + "% of supply" : "Not assessed" },
            { label: "Creator origin", value: storedCreatorMatch ? storedCreatorLabel : result.mintOrigin?.status === "initialization_signer_observed" ? "Initialization observed" : "Not established" }
          ].map(item => <div key={item.label} style={{ border: "1px solid #453535", borderRadius: 9, background: "#1a1919", padding: 12, minWidth: 0 }}>
            <div style={{ color: "#aaa", fontSize: 12 }}>{item.label}</div>
            <strong style={{ display: "block", marginTop: 8, overflowWrap: "anywhere", fontSize: 17 }}>{item.value}</strong>
          </div>)}
        </div>
        <p style={{ color: "#ffbf86", fontSize: 13, marginBottom: 0 }}>Liquidity: {liquidity?.reportedLiquidityUsd != null ? "Provider estimate $" + formatNumber(liquidity.reportedLiquidityUsd, 0) + " across reported pools" : "Not assessed"} · Overall security verdict: Not issued. Expand evidence sections below before making decisions.</p>
      </Section>
      <Section title="GLITCH ATTRIBUTE ASSESSMENT" defaultOpen={true}>
        {(() => {
          const assessment = assessTokenEvidence({ result, extensions, concentration, liquidity, creatorEvidence });
          const controls = assessTokenControls({ result, extensions, concentration });
          return <>
            <div style={{ background:"#191b1e", border:"1px solid #4a4a55", borderRadius:10, padding:14, marginBottom:14 }}>
              <strong>Token controls — creator-independent assessment</strong>
              <p style={{ color:"#ddd", margin:"8px 0" }}>{controls.label}. {controls.observedEvidencePct}% of applicable weighted controls have observations; {controls.coveragePct}% have provisional numeric coverage. Unclassified ownership and liquidity are excluded from the numeric indicator.</p>
              <p style={{ color:"#ffbf86", margin:"8px 0" }}>Permission-control rating: Withheld pending calibration. Observed permission findings remain available regardless of creator attribution.</p>
              {controls.checks.map(check => <p key={check.id} style={{fontSize:13,margin:"6px 0",color:"#bbb"}}>{check.id.replaceAll("_"," ")}: {check.status.replaceAll("_"," ")} · {check.source}</p>)}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: "1 1 180px", background: "#1b1a1a", border: "1px solid #493535", borderRadius: 10, padding: 14 }}>
                <div style={{ color: "#aaa", fontSize: 12 }}>Consolidated assessment</div>
                <strong style={{ fontSize: 22, color: "#ffbf86" }}>{assessment.consolidatedScore == null ? "Not yet established" : assessment.consolidatedScore + "/100"}</strong>
              </div>
              <div style={{ flex: "1 1 180px", background: "#1b1a1a", border: "1px solid #493535", borderRadius: 10, padding: 14 }}>
                <div style={{ color: "#aaa", fontSize: 12 }}>Evidence availability</div>
                <strong style={{ fontSize: 22 }}>{assessment.verifiedAttributes} verified · {assessment.partialAttributes} partial · {assessment.missingAttributes} missing</strong>
                <p style={{ fontSize: 12, color: "#bbb", marginBottom: 0 }}>Verified coverage: {assessment.verifiedCoveragePct}% · Available evidence: {assessment.evidenceCoveragePct}%</p>
              </div>
            </div>
            <div style={{ background: "#171c1a", border: "1px solid #355247", borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <strong style={{ display: "block", marginBottom: 8 }}>Top findings from available evidence</strong>
              {assessment.actionableFindings.length === 0 ? <p style={{ color: "#bbb" }}>Not enough evidence to issue findings yet.</p> : assessment.actionableFindings.map(item => <div key={item.id} style={{ padding: "10px 0", borderTop: "1px solid #34443e" }}>
                <strong style={{ color: item.severity === "caution" ? "#ffbf86" : "#b5dfc8" }}>{item.severity === "caution" ? "Review needed: " : "Observed: "}{item.title}</strong>
                <p style={{ color: "#ddd", fontSize: 13, margin: "6px 0" }}>{item.evidence}</p>
                <p style={{ color: "#c3d5ca", fontSize: 13, margin: "6px 0" }}>Next check: {item.nextStep}</p>
                <small style={{ color: "#aaa" }}>Evidence: {item.coverage} · {item.source}</small>
              </div>)}
            </div>
            <p style={{ color: "#bbb", fontSize: 13 }}>Numerical scores use the available on-chain evidence and update as additional transactions are discovered.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
              {assessment.attributes.map(item => <div key={item.id} style={{ background: "#191919", border: "1px solid #484040", borderRadius: 9, padding: 12 }}>
                {item.id==="concentration"&&concentration&&(()=>{
                  const h=scoreHolderConcentration({
                    top20SharePct:concentration.top20TokenAccountSharePct,
                    largestAccountSharePct:concentration.largestAccountSharePct,
                    holders:currentHolderConnections?.holders||[],
                    connectedGroups:currentHolderConnections?.connectedGroups||[],
                    directPairs:currentHolderConnections?.directPairs||0,
                    connectedWallets:currentHolderConnections?.connectedWallets||0,
                    walletHistoriesReached:currentHolderConnections?.walletHistoriesReached||0,
                    ownerWalletsResolved:concentration.ownership?.resolvedAccountCount||0,
                    historyComplete:currentHolderConnections?.historyComplete||false
                  });
                  return <div style={{marginBottom:10,padding:10,background:"#222b38",borderRadius:8}}>
                    <strong style={{fontSize:24,color:"#f3c66b"}}>{h.score??"—"} / 100</strong>
                    <p style={{fontSize:12,color:"#b6c3d3",margin:"4px 0"}}>{h.earned} points earned · {h.possible}/100 assessable</p>
                    <a href="#holder-structure-details" style={{fontSize:12,color:"#83d4ff"}}>Holder score breakdown ↓</a>
                  </div>;
                })()}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                  <strong style={{ fontSize: 14 }}>{item.label}</strong>
                  <span style={{ color: item.coverage === "missing" ? "#ffbf86" : "#9ddab6", fontWeight: 700 }}>{item.coverage === "missing" ? "Not assessed" : item.coverage === "verified" ? "Verified evidence" : "Partial evidence"}</span>
                </div>
                <p style={{ fontWeight: 700, color: item.verdict === "caution" ? "#ffbf86" : item.verdict === "no_concern_in_checked_scope" ? "#9ddab6" : "#ddd", marginBottom: 4 }}>{item.verdictLabel}</p>
                <p style={{ fontWeight: 600, color: "#ffcf9b", marginBottom: 4 }}>{item.assessment}</p>
                <p style={{ color: "#ccc", fontSize: 12, lineHeight: 1.6 }}>{item.explanation}</p>
                <small style={{ color: "#999" }}>Evidence: {item.coverage} · {item.source}</small>
              </div>)}
            </div>
            <p style={{ fontSize: 12, color: "#aaa" }}>*Provisional control score only. Overall score requires validated methodology and sufficient evidence.</p>
          </>;
        })()}
      </Section>
      <Section title={`${selectTokenInsights({ result, extensions, concentration, liquidity }).length} AVAILABLE ${selectTokenInsights({ result, extensions, concentration, liquidity }).length === 1 ? "INSIGHT" : "INSIGHTS"}`} defaultOpen={true}>
        <p style={{ color: "#aaa", fontSize: 13 }}>Prioritized observations from available evidence. Confidence describes data coverage and verification limits, not investment safety.</p>
        {selectTokenInsights({ result, extensions, concentration, liquidity }).map((insight, index) => <div key={index} style={{ borderTop: "1px solid #393939", padding: "12px 0" }}>
          <strong style={{ display: "block" }}>{index + 1}. {insight.title}</strong>
          <p style={{ margin: "5px 0", color: "#ddd", fontSize: 14 }}>{insight.detail}</p>
          <span style={{ display: "inline-block", border: "1px solid #555", borderRadius: 6, padding: "3px 8px", fontSize: 12, color: insight.evidenceClass === "onchain_observed" ? "#9ddab6" : insight.evidenceClass === "provider_reported" ? "#9acfff" : "#ffbf86" }}>
            {insight.evidenceClass === "onchain_observed" ? "On-chain observed" : insight.evidenceClass === "provider_reported" ? "Provider reported" : "Unverified / incomplete"}
          </span>
          <details style={{ marginTop: 8 }}><summary style={{ cursor: "pointer", color: "#bbb", fontSize: 12 }}>Evidence source & limitations</summary>
            <p style={{ margin: "6px 0", color: "#aaa", fontSize: 12 }}>{insight.confidence} · Source: {insight.source}</p>
          </details>
        </div>)}
        <p style={{ color: "#aaa", fontSize: 12 }}>Creator origin remains unverified unless separately supported by transaction evidence. No overall risk verdict is issued.</p>
      </Section>
      <Section title="LIQUIDITY INTELLIGENCE">
        <h3 style={{ marginTop: 0 }}>LIQUIDITY INTELLIGENCE // Pool Discovery</h3>
        <button type="button" onClick={() => refreshLiquidity()} disabled={liquidityRefreshing || busy} style={{ padding: "8px 12px", background: "#a52222", color: "white", border: 0, borderRadius: 8, cursor: "pointer" }}>{liquidityRefreshing ? "REFRESHING..." : "REFRESH LIQUIDITY"}</button>
        {liquidity?.observedAt && <p style={{ fontSize: 12, color: "#aaa" }}>Last retrieved: {new Date(liquidity.observedAt).toLocaleString()} (your local time). Provider estimates may lag blockchain state.</p>}
        {liquidityError && <p style={{ color: "#ffbf86" }}>Provider unavailable: {liquidityError}. Liquidity is not assessed.</p>}
        {!liquidity && !liquidityError && <p style={{ color: "#aaa" }}>Retrieving reported trading pools...</p>}
        {liquidity && <>
          <p><strong>Reported pools:</strong> {liquidity.poolCountReturned}</p>
          <p><strong>Reported liquidity estimate:</strong> {liquidity.reportedLiquidityUsd == null ? "Unavailable" : "$" + formatNumber(liquidity.reportedLiquidityUsd, 0)}</p>
          <p><strong>Largest reported pool share:</strong> {liquidity.largestReportedPoolSharePct == null ? "Unavailable" : formatNumber(liquidity.largestReportedPoolSharePct, 2) + "%"}</p>
          <p style={{ color: "#ffbf86", fontSize: 13 }}>LP locks / burns / withdrawal permissions: Not verified</p>
          <button type="button" disabled={poolEvidenceBusy || busy || !(liquidity.pools || []).length} onClick={verifyPoolAccounts} style={{ padding: "8px 12px", background: "#a52222", color: "white", border: 0, borderRadius: 8, cursor: "pointer" }}>
            {poolEvidenceBusy ? "CHECKING ON-CHAIN ACCOUNTS..." : "VERIFY FIRST 5 POOL ACCOUNTS"}
          </button>
          <p style={{ color: "#aaa", fontSize: 12 }}>Checks account existence and owner program only, not authentic pool status, reserves, LP locks or withdrawal rights.</p>
          {poolEvidenceError && <p role="alert" style={{ color: "#ffbf86" }}>On-chain account check unavailable: {poolEvidenceError}</p>}
          {poolEvidence && <details><summary style={{ cursor: "pointer" }}>On-chain account evidence ({poolEvidence.pools?.length || 0} checked)</summary>
            <p style={{ color: "#aaa", fontSize: 12 }}>Source: {poolEvidence.source}; observed {poolEvidence.observedAt}. Not a pool security verdict.</p>
            {(poolEvidence.pools || []).map(pool => <div key={pool.pairAddress} style={{ borderTop: "1px solid #333", padding: "10px 0", overflowWrap: "anywhere", fontSize: 13 }}>
              <strong>Account: {pool.pairAddress}</strong>
              <p>Exists: {pool.accountExists ? "Yes" : "No"} · Owner program: {pool.accountOwnerProgram || "Unavailable"}</p>
              <p style={{ color: "#ffbf86" }}>Pool protocol, reserves, LP locks and withdrawal permissions: Unverified</p>
            </div>)}
          </details>}
          <details><summary style={{ cursor: "pointer" }}>View reported trading pools ({liquidity.pools?.length || 0})</summary>
            {(liquidity.pools || []).map((pool, index) => <div key={pool.pairAddress + index} style={{ borderTop: "1px solid #333", padding: "10px 0", fontSize: 13 }}>
              <strong>{pool.dexId || "Unknown DEX"} · {pool.baseSymbol || "?"}/{pool.quoteSymbol || "?"}</strong>
              <p>Liquidity: {pool.liquidityUsd == null ? "Unknown" : "$" + formatNumber(pool.liquidityUsd, 0)} · 24h volume: {pool.volume24hUsd == null ? "Unknown" : "$" + formatNumber(pool.volume24hUsd, 0)}</p>
              {pool.url && <a href={pool.url} target="_blank" rel="noopener noreferrer" style={{ color: "#83d4ff" }}>View pool data ↗</a>}
            </div>)}
          </details>
          <p style={{ color: "#aaa", fontSize: 12 }}>Source: {liquidity.provider}, observed {liquidity.observedAt}. {liquidity.coverage?.warning}</p>
        </>}
      </Section>
      <Section title="TOKEN DETAILS">
      <p><strong>Mint:</strong> {result.mint}</p>
      <p><strong>Token program:</strong> {result.tokenProgram}</p>
      <p><strong>Supply:</strong> {result.supply ?? "Unavailable"}</p>
      </Section>
      <div id="holder-structure-details"><Section title="HOLDER CONCENTRATION">
        <h3 style={{ marginTop: 0 }}>TOKEN ACCOUNT CONCENTRATION // Evidence</h3>
        {concentrationError && <p style={{ color: "#ffb86b" }}>Account concentration unavailable: {concentrationError}. No conclusion inferred.</p>}
        {!concentration && !concentrationError && <p style={{ color: "#aaa" }}>Retrieving largest token accounts...</p>}
        {concentration && (() => {
          const assessment=scoreHolderConcentration({
            top20SharePct:concentration.top20TokenAccountSharePct,
            largestAccountSharePct:Number(concentration.largestAccountSharePct),
            holders:currentHolderConnections?.holders||[],
            connectedGroups:currentHolderConnections?.connectedGroups||[],
            directPairs:currentHolderConnections?.directPairs||0,
            connectedWallets:currentHolderConnections?.connectedWallets||0,
            walletHistoriesReached:currentHolderConnections?.walletHistoriesReached||0,
            ownerWalletsResolved:concentration.ownership?.resolvedAccountCount||0,
            historyComplete:currentHolderConnections?.historyComplete||false
          });
          return <div style={{background:"#151c2a",border:"1px solid #334154",borderRadius:18,padding:22,marginBottom:16}}>
            <div style={{fontSize:12,letterSpacing:1,color:"#aab9cc"}}>GLITCH HOLDER STRUCTURE SCORE</div>
            <div style={{fontSize:38,fontWeight:800,color:"#f3c66b"}}>{assessment.score===null?"—":assessment.score}<span style={{fontSize:18,color:"#9ca8b9"}}> / 100</span></div>
            <p style={{fontSize:13,color:"#bac4d3"}}>{assessment.score===null?"Current observed-data score; historical investigation continues in the background.":"Numerical holder-structure assessment based on observed data."}</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:10}}>
              {assessment.components.map(item=><div key={item.id} style={{background:"#20293a",borderRadius:12,padding:13}}>
                <div style={{fontSize:13,color:"#c3ccda"}}>{item.label}</div>
                <strong style={{fontSize:22,color:"#f3c66b"}}>{item.score===null?"—":item.score}</strong><span style={{color:"#9ca8b9"}}> / {item.max}</span>
              </div>)}
            </div>
            <p style={{fontSize:12,color:"#9ca8b9"}}>Scores are based on retrievable on-chain data available at the time of analysis. Historical coverage may vary, and transaction connections do not establish coordinated trading.</p>
          </div>;
        })()}
        {concentration && <>
          <div style={{background:"#171c1a",border:"1px solid #355247",borderRadius:10,padding:14,marginBottom:12}}>
            <strong>LIVE HOLDER CONNECTIONS</strong>
            {holderConnections && !currentHolderConnections && <p style={{color:"#ffbf86"}}>Historical holder set differs from current live accounts. Connections are excluded from the current score until refreshed.</p>}
            {holderConnectionsBusy && <p role="status">Retrieving saved holder intelligence…</p>}
            {holderConnectionsError && <p style={{color:"#ffbf86"}}>{holderConnectionsError}</p>}
            {currentHolderConnections && <>
              <p><strong>Top-20 supply:</strong> {currentHolderConnections.top20SharePct.toFixed(2)}% · <strong>Connected wallets:</strong> {currentHolderConnections.connectedWallets}/{currentHolderConnections.ownerWalletsResolved} · <strong>Direct pairs:</strong> {currentHolderConnections.directPairs}</p>
              <p>Transactions checked: {currentHolderConnections.transactionsChecked} · Wallet histories reached: {currentHolderConnections.walletHistoriesReached}/20 · Older history may remain</p>
              <HolderBubbleMap holders={currentHolderConnections.holders||[]} groups={currentHolderConnections.connectedGroups||[]} scanStatus={currentHolderConnections.status||"partial"} transactionsChecked={currentHolderConnections.transactionsChecked} walletHistoriesReached={currentHolderConnections.walletHistoriesReached}/>
              {currentHolderConnections.connectedGroups.map((group,index)=><details key={index}><summary>Connected group {index+1}: {group.members.length} wallets · {group.combinedObservedSharePct.toFixed(2)}% of supply</summary>
                {group.members.map(wallet=><p key={wallet}><AddressLink address={wallet}/></p>)}
                {group.directEdges.flatMap(edge=>edge.signatures).slice(0,10).map(sig=><p key={sig}><a href={"https://solscan.io/tx/"+encodeURIComponent(sig)} target="_blank" rel="noopener noreferrer">Transaction {sig.slice(0,12)}… ↗</a></p>)}
              </details>)}
              <small style={{color:"#aaa"}}>Stored investigation updated {currentHolderConnections.observedAt||"time unavailable"}. Live balances appear in the account concentration figures below. Connections indicate transfers, not shared ownership.</small>
            </>}
          </div>
          <p><strong>Largest account:</strong> {concentration.largestAccountSharePct ?? "Unavailable"}% of supply</p>
          <p><strong>Top 5 token accounts:</strong> {concentration.top5TokenAccountSharePct ?? "Unavailable"}% · <strong>Top 10:</strong> {concentration.top10TokenAccountSharePct ?? "Unavailable"}%</p>
          <p style={{ color: "#ffbf86", fontSize: 13 }}>{concentration.coverage?.warning}</p>
          {concentration.ownership && <div style={{ padding: 12, border: "1px solid #39483f", borderRadius: 8, marginBottom: 12 }}>
            <strong>OBSERVED TOKEN-ACCOUNT OWNERS</strong>
            <p style={{ color: "#bbb", fontSize: 13 }}>Owner addresses resolved for {concentration.ownership.resolvedAccountCount}/{concentration.returnedAccounts} sampled accounts. These are SPL token-account owners, not verified beneficial owners.</p>
            {(concentration.ownership.observedOwnerGroups || []).slice(0,5).map((group,index)=><p key={group.ownerWallet} style={{ fontSize: 13, overflowWrap: "anywhere" }}>
              {index+1}. <AddressLink address={group.ownerWallet} /> · {group.tokenAccountCount} account(s) · {group.sharePct.toFixed(2)}% observed supply
            </p>)}
            {storedCreatorMatch && <p style={{ color: "#ddd", fontSize: 13 }}>
              <strong>Creator wallet comparison:</strong> {(() => {
                const matching=(concentration.ownership.observedOwnerGroups||[]).find(group=>group.ownerWallet===creatorEvidence.creator);
                return matching ? "Creator wallet controls "+matching.tokenAccountCount+" sampled token account(s), holding "+matching.sharePct.toFixed(2)+"% of supply in this sample." :
                  "Creator wallet does not directly own any of the 20 sampled largest token accounts. This does not prove zero holdings or exclude linked wallets.";
              })()}
            </p>}
            <small style={{ color: "#aaa" }}>Pool, exchange and custody classifications remain unverified. The sample covers only the largest returned accounts.</small>
          </div>}
          <details><summary style={{ cursor: "pointer", color: "#ddd" }}>View largest token accounts ({concentration.returnedAccounts})</summary>
            {(concentration.accounts || []).map(account => <p key={account.tokenAccount} style={{ fontSize: 12 }}>#{account.rank} · {account.sharePct}% · <a href={"https://solscan.io/account/" + encodeURIComponent(account.tokenAccount)} target="_blank" rel="noopener noreferrer" style={{ color: "#83d4ff", overflowWrap: "anywhere" }}>{account.tokenAccount}</a></p>)}
          </details>
          <p style={{ color: "#aaa", fontSize: 12 }}>Source: {concentration.coverage?.source}. Token-account owners are grouped where available; beneficial ownership, pool balances and exchange custody remain unresolved. No risk verdict.</p>
        </>}
      </Section></div>
      {result.tokenProgram === "spl-token-2022" && <Section title="TOKEN SECURITY">
        <h3 style={{ marginTop: 0 }}>TOKEN-2022 EXTENSIONS // Evidence</h3>
        {extensionsError && <p style={{ color: "#ffbf86" }}>Inspection unavailable: {extensionsError}. No safety conclusion inferred.</p>}
        {!extensions && !extensionsError && <p style={{ color: "#aaa" }}>Inspecting mint extensions...</p>}
        {extensions && <>
          <p><strong>Status:</strong> {extensions.status === "parsed_extensions_observed" ? "Parsed mint extensions retrieved" : "Not verified"}</p>
          {extensions.status === "parsed_extensions_observed" && <p><strong>Observed extensions:</strong> {extensions.extensionCount}</p>}
          {(extensions.extensions || []).map((extension, i) => <p key={extension.type + i} style={{ color: "#ddd" }}>• {extension.label} <span style={{ color: "#aaa" }}>({extension.type})</span></p>)}
          {extensions.transferFee?.status === "observed" && <div style={{ padding: 12, border: "1px solid #654a32", borderRadius: 8, marginTop: 12 }}>
            <strong>TRANSFER FEE CONFIGURATION</strong>
            {["olderFee", "newerFee"].map(key => <p key={key} style={{ fontSize: 13 }}>
              {key === "olderFee" ? "Older fee schedule" : "Newer fee schedule"}: {extensions.transferFee[key]
                ? extensions.transferFee[key].percentage + "% (" + extensions.transferFee[key].basisPoints + " bps), max " + extensions.transferFee[key].maximumFeeRaw + " raw units, epoch " + (extensions.transferFee[key].epoch ?? "unknown")
                : "Not parsed"}
            </p>)}
            <p style={{ fontSize: 13 }}>Fee configuration authority: {extensions.transferFee.configAuthorityReported ? (extensions.transferFee.configAuthority || "None (revoked)") : "Unknown (not returned)"}</p>
            <p style={{ fontSize: 13 }}>Withheld-fee withdrawal authority: {extensions.transferFee.withdrawalAuthorityReported ? (extensions.transferFee.withdrawalAuthority || "None (revoked)") : "Unknown (not returned)"}</p>
            <details style={{ marginTop: 8 }}><summary style={{ cursor: "pointer", color: "#ccc" }}>Inspect authority addresses</summary>
              {["configAuthority", "withdrawalAuthority"].map(key => extensions.transferFee[key] && <p key={key} style={{ overflowWrap: "anywhere", fontSize: 12 }}>{key}: <a href={"https://solscan.io/account/" + encodeURIComponent(extensions.transferFee[key])} target="_blank" rel="noopener noreferrer" style={{ color: "#83d4ff" }}>{extensions.transferFee[key]}</a></p>)}
            </details>
            <p style={{ fontSize: 12, color: "#aaa" }}>{extensions.transferFee.note}</p>
          </div>}
          <p style={{ color: "#aaa", fontSize: 12 }}>{extensions.coverage?.limitations || extensions.reason || extensions.interpretation}</p>
        </>}
      </Section>}
      <Section title="CREATOR INTELLIGENCE">
      <p><strong>Mint authority:</strong> {result.authorityDetailsStatus === "not_parsed" ? "Not available from parsed account" : (result.mintAuthority || "None")}</p>
      <p><strong>Freeze authority:</strong> {result.authorityDetailsStatus === "not_parsed" ? "Not available from parsed account" : (result.freezeAuthority || "None")}</p>
      <p style={{ color: "#aaa", fontSize: 12 }}><strong>Creator evidence lookup:</strong> {({
        not_requested: "Not requested",
        record_available: "Stored creator evidence returned",
        record_not_established: "No verified creator record returned",
        indexed_candidate: "Indexed creator candidate available; on-chain proof pending",
        cache_miss: "No creator attribution record stored for this mint",
        evidence_incomplete: "Stored creator evidence incomplete or mismatched",
        evidence_conflict: "Conflicting creator evidence requires investigation",
        vault_unavailable: "Intelligence Vault unavailable or not configured for this preview",
        lookup_failed: "Creator evidence service returned an error",
        network_failure: "Creator evidence request could not complete"
      })[creatorEvidenceDiagnostic] || "Status unavailable"}</p>
      {creatorEvidence?.status === "INDEXED_UNVERIFIED" && creatorEvidence.creator && <p style={{ color: "#ffcf9b", fontSize: 13, overflowWrap: "anywhere" }}><strong>Indexed creator candidate (not verified):</strong> <AddressLink address={creatorEvidence.creator} /> · Creation instruction proof not yet established. Do not infer beneficial ownership or creator behavior.</p>}
      <p style={{ color: "#ffbf86" }}><strong>Creator attribution:</strong> {storedCreatorMatch ? storedCreatorLabel : result.creator?.status === "provider_attributed" ? "Provider-identified creator; on-chain confirmation pending" : "Creator not yet identified by available evidence."}</p>
      {result.creator?.status === "provider_attributed" && <p><strong>Solscan creator address:</strong> <a href={"https://solscan.io/account/" + encodeURIComponent(result.creator.address)} target="_blank" rel="noopener noreferrer" style={{ color: "#83d4ff", overflowWrap: "anywhere" }}>{result.creator.address}</a></p>}
      <div style={{ border: "1px solid #453535", borderRadius: 9, padding: 12, margin: "12px 0" }}>
        <strong>LAUNCHPAD & CREATOR EVIDENCE</strong>
        <p><strong>Launchpad:</strong> {storedCreatorMatch && creatorEvidence?.evidence?.[0]?.programId === "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P" ? "Pump.fun — creation instruction decoded on-chain; independent review " + (creatorEvidence.status === "VERIFIED" ? "completed" : "pending") : result.launchpadEvidence?.status === "program_interaction_observed" ? result.launchpadEvidence.platform + " — program interaction observed; launch unverified" : "Unknown / not verified"}</p>
        {result.stonkFunEvidence && <div style={{ border: "1px solid #4c4440", borderRadius: 8, padding: 10, margin: "10px 0", background: "#1c1919" }}>
          <strong>StonkFun public index investigation</strong>
          <p><strong>Record status:</strong> {result.stonkFunEvidence.status === "provider_record_observed" ? "Exact mint matched (provider-reported)" : result.stonkFunEvidence.status === "not_found" ? "No matching record in retrieved index" : result.stonkFunEvidence.status === "provider_unavailable" ? "Provider retrieval unavailable" : result.stonkFunEvidence.status}</p>
          {result.stonkFunEvidence.creatorCandidate && <p><strong>Reported creator candidate (unverified):</strong> {result.stonkFunEvidence.creatorCandidate}</p>}
          {result.stonkFunEvidence.signature && <p><a href={"https://solscan.io/tx/" + encodeURIComponent(result.stonkFunEvidence.signature)} target="_blank" rel="noopener noreferrer" style={{ color: "#83d4ff" }}>Inspect provider-reported transaction ↗</a></p>}
          {result.stonkFunEvidence.diagnostic && <p style={{ color: "#bbb", fontSize: 12 }}>{result.stonkFunEvidence.diagnostic}</p>}
          <small style={{ color: "#aaa" }}>A provider listing does not establish the creator or original launch transaction.</small>
        </div>}
        <p><strong>Launch creator wallet:</strong> {storedCreatorMatch ? <AddressLink address={creatorEvidence.creator} /> : result.launchpadEvidence?.launchCreatorVerified && result.launchpadEvidence?.launchCreator ? result.launchpadEvidence.launchCreator : "Not identified"}</p>
        <p><strong>Observed transaction:</strong> {(storedCreatorMatch ? creatorEvidence.evidence?.[0]?.signature : result.launchpadEvidence?.signature) ? <a href={"https://solscan.io/tx/" + encodeURIComponent(storedCreatorMatch ? creatorEvidence.evidence[0].signature : result.launchpadEvidence.signature)} target="_blank" rel="noopener noreferrer" style={{ color: "#83d4ff" }}>View on Solscan ↗</a> : "Not available"}</p>
        <p><strong>Transaction timestamp:</strong> {result.launchpadEvidence?.blockTime ? new Date(result.launchpadEvidence.blockTime * 1000).toLocaleString() : "Unknown"}</p>
        <p style={{ color: "#ffbf86", fontSize: 12 }}>{result.launchpadEvidence?.reason || "No launchpad evidence available."} A trading pool or mint signer alone does not establish launch creator identity.</p>
        <details><summary style={{ cursor: "pointer" }}>View attribution candidates ({result.creatorEvidence?.claims?.length || 0})</summary>
          {(result.creatorEvidence?.claims || []).map((claim, index) => <div key={claim.kind + claim.address + index} style={{ borderTop: "1px solid #333", padding: "8px 0", fontSize: 12, overflowWrap: "anywhere" }}>
            <strong>{claim.label}</strong>
            <p>{claim.address} · {claim.verification} · Source: {claim.source}</p>
            {claim.signature && <a href={"https://solscan.io/tx/" + encodeURIComponent(claim.signature)} target="_blank" rel="noopener noreferrer" style={{ color: "#83d4ff" }}>Inspect transaction ↗</a>}
            <p style={{ color: "#aaa" }}>{claim.limitation}</p>
          </div>)}
        </details>
      </div>
      <p style={{ color: "#aaa", fontSize: 12 }}>Solscan API: {result.solscanDiagnostic?.status === "provider_attributed" ? "Creator attribution returned" : result.solscanDiagnostic?.status === "not_configured" ? "SOLSCAN_API_KEY missing in Preview" : result.solscanDiagnostic?.status === "unavailable" ? "Unavailable (" + (result.solscanDiagnostic?.diagnostic || "unknown") + ")" : result.solscanDiagnostic?.status || "Not reported"}</p>
      <p><strong>Mint origin investigation:</strong> {result.mintOrigin?.status === "initialization_signer_observed" ? "Initialization signer observed" : "Origin not verified"}</p>
      {result.mintOrigin?.address && <p><strong>Initialization signer (not verified creator):</strong> {result.mintOrigin.address}</p>}
      {result.mintOrigin?.signature && <p><a href={"https://solscan.io/tx/" + encodeURIComponent(result.mintOrigin.signature)} target="_blank" rel="noopener noreferrer" style={{ color: "#83d4ff" }}>View mint initialization evidence ↗</a></p>}
      <p style={{ color: "#aaa", fontSize: 12 }}>{result.mintOrigin?.reason}</p>
      <p style={{ color: "#aaa", fontSize: 12 }}>Helius connectivity: {result.historicalProvider?.connectivity === "confirmed" ? "Confirmed — RPC responded" : result.historicalProvider?.connectivity === "failed" ? "Failed — check endpoint and API key in Vercel" : result.historicalProvider?.connectivity === "not_configured" ? "Not configured" : "Not tested"}</p>
      <p style={{ color: "#aaa", fontSize: 12 }}>Provider diagnostic: {result.historicalProvider?.diagnostic === "missing_env" ? "HELIUS_RPC_URL not available in this deployment" : result.historicalProvider?.diagnostic === "invalid_url_format" ? "HELIUS_RPC_URL exists but is not a valid HTTPS endpoint" : result.historicalProvider?.diagnostic === "connection_confirmed" ? "Helius HTTPS endpoint verified and responding" : result.historicalProvider?.diagnostic === "connection_failed" ? "Helius endpoint did not respond successfully" : result.historicalProvider?.diagnostic === "configured_not_verified" ? "HTTPS endpoint configured; connectivity not yet confirmed" : "Not reported"}</p>
      <p style={{ color: "#aaa", fontSize: 12 }}>History provider: {result.historicalProvider?.mode === "configured_archival_rpc" ? result.historicalProvider?.connectivity === "confirmed" ? "Helius RPC connected" : "Helius endpoint configured (connection success not verified)" : "Standard Solana RPC (Helius not configured for this deployment)"}. Archival completeness is not verified.</p>
      <p style={{ color: "#aaa", fontSize: 12 }}>Historical scan batches: {historyBatches} · Pages in latest batch: {result.mintOrigin?.coverage?.pagesScanned ?? 0}. A complete archival history is not guaranteed.</p>
      {historyCursor && historyBatches < MAX_HISTORY_BATCHES && <button type="button" disabled={busy} onClick={() => inspect({ preventDefault() {} }, historyCursor)} style={{ background: "#a52222", color: "white", border: 0, borderRadius: 8, padding: "12px 16px", cursor: "pointer" }}>{busy ? "SEARCHING..." : "SEARCH OLDER MINT HISTORY"}</button>}
      {historyCursor && historyBatches >= MAX_HISTORY_BATCHES && <p style={{ color: "#ffbf86" }}>RPC search limit reached (up to 15,000 signatures requested). Further origin attribution needs an archival/indexed provider; creator remains unverified.</p>}
      <p style={{ color: "#aaa", fontSize: 12 }}>RPC history exhausted within scan: {result.mintOrigin?.coverage?.historyExhaustedWithinRpc ? "Yes (archival completeness unverified)" : "No / unknown"}</p>
      <p style={{ color: "#aaa" }}>Holding time and prior launches: Not yet assessed. No risk verdict issued.</p>
      <a href={"https://solscan.io/token/" + encodeURIComponent(result.mint)} target="_blank" rel="noopener noreferrer" style={{ color: "#83d4ff" }}>Verify mint on Solscan ↗</a>
      </Section>
    </div>}
  </section>;
}

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [analysisMode, setAnalysisMode] = useState("wallet");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const [walletData, setWalletData] = useState(null);
  const [transactionData, setTransactionData] = useState(null);
  const [glitchData, setGlitchData] = useState(null);

  const [walletError, setWalletError] = useState("");
  const [transactionError, setTransactionError] = useState("");
  const [glitchError, setGlitchError] = useState("");
  const [analysisFinished, setAnalysisFinished] = useState(false);
  const [moduleTimings, setModuleTimings] = useState(null);
  const requestVersion = useRef(0);

  async function fetchModule(endpoint, address) {
    const response = await fetch(
      endpoint + "?address=" + encodeURIComponent(address),
      { cache: "no-store" }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Unable to retrieve intelligence"
      );
    }

    return result;
  }

  async function timedModule(endpoint, address) {
    const start = performance.now();
    try {
      const data = await fetchModule(endpoint, address);
      return { data, elapsedMs: Math.round(performance.now() - start) };
    } catch (error) {
      error.elapsedMs = Math.round(performance.now() - start);
      throw error;
    }
  }

  async function analyzeWallet() {
    const address = wallet.trim();

    if (!address) {
      setStatus("Please enter a Solana wallet address.");
      return;
    }

    const version = ++requestVersion.current;
    setLoading(true);
    setAnalysisFinished(false);
    setModuleTimings(null);
    setStatus("Connecting to Solana Mainnet...");

    setWalletData(null);
    setTransactionData(null);
    setGlitchData(null);

    setWalletError("");
    setTransactionError("");
    setGlitchError("");

    try {
      // Fetch the lightweight overview first, then overlap the two deep modules.
      // This avoids launching all three RPC-heavy requests simultaneously.
      const startedAt = performance.now();
      setStatus("Loading wallet intelligence...");
      const timings = {};
      try {
        const result = await timedModule("/api/wallet", address);
        timings.wallet = result.elapsedMs;
        if (version !== requestVersion.current) return;
        setWalletData(result.data);
      } catch (error) {
        timings.wallet = error.elapsedMs ?? null;
        if (version !== requestVersion.current) return;
        setWalletError(error.message);
      }

      setStatus("Analyzing transactions and GLITCH evidence...");
      const [transactionsResult, glitchResult] = await Promise.allSettled([
        timedModule("/api/transactions", address),
        timedModule("/api/glitch", address)
      ]);
      if (version !== requestVersion.current) return;
      if (transactionsResult.status === "fulfilled") {
        timings.transactions = transactionsResult.value.elapsedMs;
        setTransactionData(transactionsResult.value.data);
      } else {
        timings.transactions = transactionsResult.reason?.elapsedMs ?? null;
        setTransactionError(transactionsResult.reason?.message || "Transaction intelligence unavailable");
      }
      if (glitchResult.status === "fulfilled") {
        timings.glitch = glitchResult.value.elapsedMs;
        setGlitchData(glitchResult.value.data);
      } else {
        timings.glitch = glitchResult.reason?.elapsedMs ?? null;
        setGlitchError(glitchResult.reason?.message || "GLITCH evidence unavailable");
      }
      timings.total = Math.round(performance.now() - startedAt);
      setModuleTimings(timings);
      console.info("[Wallet Signal] module timings (ms)", timings);

      if (version === requestVersion.current) setStatus("");

    } catch (error) {
      if (version === requestVersion.current) setStatus("Analysis error: " + error.message);
    } finally {
      if (version === requestVersion.current) {
        setAnalysisFinished(true);
        setLoading(false);
      }
    }
  }

  const hasModuleError = Boolean(walletError || transactionError || glitchError);
  const walletAnalysisComplete = analysisFinished && !loading && Boolean(walletData) && !walletError;
  const emptyWallet = walletAnalysisComplete && walletData?.dataCoverage?.transactionsRetrieved === 0;
  const glitchDecoded = glitchData?.coverage?.transactionsDecoded ?? 0;
  const glitchRetrieved = glitchData?.coverage?.signaturesRetrieved ?? 0;
  const glitchEvidenceSufficient = glitchDecoded > 0 &&
    glitchData?.evidence?.confidence === "sample_only" &&
    ["bounded_sample", "sample_limit_reached"].includes(glitchData?.evidence?.sampleCompleteness);
  const walletScoreEligible = walletData?.dataCoverage?.scoringEligible === true &&
    walletData?.intelligence?.scoringStatus === "preliminary";
  const signalReady = walletAnalysisComplete && !hasModuleError &&
    walletScoreEligible && glitchEvidenceSufficient;
  const partialAnalysis = walletAnalysisComplete && !hasModuleError &&
    walletScoreEligible && !signalReady;

  const activity = walletData?.activity || {};
  const intelligence = walletData?.intelligence || {};
  const coverage = walletData?.dataCoverage || {};

  const categories = transactionData?.categories
    ? Object.entries(transactionData.categories)
    : [];

  const glitchEvidence = glitchData?.evidence || null;
  const glitchSummary = glitchData?.summary || {};
  const glitchCoverage = glitchData?.coverage || {};
  const behavior = glitchData?.behaviorIntelligence || {};
  const frequency = behavior.frequency || {};
  const concentration = behavior.concentration || {};

  const counterparties =
    glitchData?.topCounterparties || [];

  const transfers = glitchData?.transfers || [];

  const weeklyActivity = Array.isArray(activity.weeklyActivity)
    ? activity.weeklyActivity
    : [];

  const maxWeeklyActivity = Math.max(
    1,
    ...weeklyActivity.map(
      (week) => Number(week.transactions) || 0
    )
  );

  return (
    <main
      style={{
        minHeight: analysisMode === "token" || analysisFinished ? "100vh" : "100dvh",
        height: analysisMode === "token" || (analysisFinished && walletData && !walletError) ? "auto" : "100dvh",
        overflowY: analysisMode === "token" || (analysisFinished && walletData && !walletError) ? "visible" : "hidden",
        boxSizing: "border-box",
        background: "#080808",
        color: "#fff",
        padding: "clamp(12px, 3vh, 30px) 20px",
        fontFamily: "Arial, sans-serif"
      }}
    >

      <style>{`
        .doom-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(210px, 360px); align-items: center; gap: 12px; margin-bottom: -46px; }
        .doom-mascot { position: relative; width: 100%; max-width: 360px; aspect-ratio: 1; isolation: isolate; perspective: 900px; margin: 0 auto; }
        @media (min-width:641px) { .doom-hero .doom-mascot { transform:translateY(-28px); } }
        .doom-mascot__image { position: relative; z-index: 2; display: block; width: 100%; height: 100%; object-fit: contain; border-radius: 0; filter: drop-shadow(0 16px 30px #d3192433); transition: filter 800ms ease; animation: doom-float 4.5s ease-in-out infinite; transform-style: preserve-3d; }
        .doom-mascot__beam { position: absolute; z-index: 3; inset: 12% 8%; border-top: 3px solid #ff4a5d; filter: drop-shadow(0 0 12px #ff304b); opacity: 0; pointer-events: none; }
        .doom-mascot--scanning .doom-mascot__beam { opacity: 1; animation: doom-scan 1.8s ease-in-out infinite alternate; }
        .doom-mascot__indicator { position: absolute; z-index: 4; bottom: 0; left: 50%; transform: translateX(-50%); background: #101010e8; color: #ff707b; border: 1px solid #8c2935; border-radius: 999px; padding: 7px 13px; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; white-space: nowrap; }
        /* Signal-ready treatment: preserve the dark visor, intensify emerald accents and dissolve the source image's rectangular edges. */
        .doom-mascot--complete .doom-mascot__image {
          filter: hue-rotate(125deg) saturate(1.65) contrast(1.22) brightness(.88) drop-shadow(0 0 12px #26f58c88);
          -webkit-mask-image: radial-gradient(ellipse 65% 69% at 50% 47%, #000 62%, transparent 100%);
          mask-image: radial-gradient(ellipse 65% 69% at 50% 47%, #000 62%, transparent 100%);
        }
        @media (prefers-reduced-motion: reduce) { .doom-mascot__image { transition: none; animation: none; } }
        .doom-mascot--complete .doom-mascot__indicator { color: #6cecb4; border-color: #287f56; }
        @keyframes doom-float { 0%,100% { transform: translateY(0) rotateY(-4deg) rotateX(2deg); } 50% { transform: translateY(-12px) rotateY(4deg) rotateX(-2deg); } }
        @keyframes doom-scan { from { transform: translateY(10%); } to { transform: translateY(85%); } }
        @media (max-width: 640px) { .doom-hero { margin-bottom: 0; } .doom-hero { grid-template-columns: minmax(0, 1fr) minmax(120px, 40%); gap: 8px; } .doom-mascot__indicator { font-size: 8px; padding: 5px 8px; letter-spacing: .5px; } }
        @media (max-width: 380px) { .doom-hero { grid-template-columns: minmax(0, 1fr) minmax(105px, 36%); gap: 6px; } .doom-mascot__indicator { letter-spacing: 0; } }
        .doom-wallet-controls { display:grid; grid-template-columns:minmax(0,1fr) 190px; align-items:end; gap:12px; margin-top:12px; }
        .doom-wallet-controls input { min-width:0; }\n        @media (max-width:640px) { .doom-wallet-controls { grid-template-columns:minmax(0,1fr); gap:10px; } }\n        .doom-scan-panel { display:flex; align-items:center; gap:16px; margin-top:16px; padding:14px 18px; border:1px solid #922b3f; border-radius:16px; background:linear-gradient(110deg,#220b12,#11090d 65%,#210911); box-shadow:0 0 22px #b91b3022; }
        .doom-scan-thumb { width:76px; height:76px; flex-shrink:0; object-fit:cover; border-radius:12px; }
        .doom-scan-content { flex:1; min-width:0; }
        .doom-scan-title { color:#ff5369; font-size:16px; font-weight:800; letter-spacing:1.3px; }
        .doom-scan-stage { color:#b8a5aa; margin:6px 0 13px; font-size:13px; }
        .doom-scan-track { height:10px; border-radius:999px; overflow:hidden; background:#46212c; }
        .doom-scan-indeterminate { width:34%; height:100%; border-radius:999px; background:linear-gradient(90deg,#a81735,#ff3b58,#ff9aa9); box-shadow:0 0 16px #ff365c99; animation:doom-scan-progress 1.7s ease-in-out infinite alternate; }
        @keyframes doom-scan-progress { from { transform:translateX(0); } to { transform:translateX(194%); } }
        @media (max-width:640px) { .doom-scan-panel { gap:12px; padding:12px; } .doom-scan-thumb { width:56px; height:56px; } .doom-scan-title { font-size:14px; } }
        @media (prefers-reduced-motion:reduce) { .doom-scan-indeterminate { animation:none; width:100%; opacity:.75; } }
        /* Compact only the desktop scanning layout; preserve mascot dimensions. */
        @media (min-width:641px) {
          .doom-wallet-card { padding:14px 18px !important; }
          .doom-wallet-controls { margin-top:8px; }
          .doom-scan-panel { margin-top:9px; padding:9px 16px; }
          .doom-scan-thumb { width:62px; height:62px; }
          .doom-scan-stage { margin:3px 0 8px; }
        }
        .doom-result-section { margin-top: 16px; border: 1px solid #383838; border-radius: 12px; background: #111; overflow: hidden; }
        .doom-result-heading { cursor: pointer; list-style: none; padding: 18px 20px; font-size: 19px; font-weight: 700; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .doom-result-heading::-webkit-details-marker { display: none; }
        .doom-result-heading:focus-visible { outline: 2px solid #ff5b65; outline-offset: -3px; }
        .doom-result-chevron { color: #ff7777; font-size: 25px; transition: transform .2s ease; }
        .doom-result-section[open] .doom-result-chevron { transform: rotate(180deg); }
        .doom-result-content { padding: 0 18px 20px; }
      `}</style>
      <div
        style={{
          maxWidth: "1050px",
          margin: "0 auto"
        }}
      >

        <div className="doom-hero">
          <div>
            <p
              style={{
                color: "#ff4444",
                fontWeight: "bold",
                letterSpacing: "2px",
                fontSize: "12px"
              }}
            >
              DOOM404 // INTELLIGENCE SYSTEM
            </p>
    
            <h1
              style={{
                fontSize: "clamp(36px, 7vw, 62px)",
                marginBottom: "12px"
              }}
            >
              Wallet Signal
            </h1>
    
            <p
              style={{
                color: "#aaa",
                lineHeight: 1.7
              }}
            >
              Explore observable Solana wallet activity,
              transaction behaviour, SOL transfer flows
              and transparent intelligence signals.
            </p>
    
    
          </div>
          <MascotDisplay loading={loading} complete={signalReady} partial={partialAnalysis} />
        </div>

        <div role="tablist" aria-label="Analysis type" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18 }}>
          {[{ id: "wallet", label: "WALLET ANALYSIS" }, { id: "token", label: "TOKEN ANALYSIS" }].map(item =>
            <button key={item.id} type="button" role="tab" aria-selected={analysisMode === item.id} onClick={() => setAnalysisMode(item.id)}
              style={{ padding: "14px 8px", background: analysisMode === item.id ? "#aa2525" : "#1b1b1b", color: "#fff", border: analysisMode === item.id ? "1px solid #d84949" : "1px solid #555", borderRadius: 9, fontWeight: 700, fontSize: "clamp(11px, 2.5vw, 14px)", cursor: "pointer" }}>
              {item.label}
            </button>
          )}
        </div>
        {analysisMode === "token" ? <div role="tabpanel" aria-label="Token Analysis"><CreatorLookup /></div> : <div role="tabpanel" aria-label="Wallet Analysis">
        <div className="doom-wallet-card" style={cardStyle}>
          <label
            htmlFor="wallet-address"
            style={{
              color: "#aaa",
              fontSize: "13px"
            }}
          >
            SOLANA WALLET ADDRESS
          </label>

          <div className="doom-wallet-controls">
          <input
            id="wallet-address"
            value={wallet}
            onChange={(event) => {
              requestVersion.current += 1;
              setWallet(event.target.value);
              setAnalysisFinished(false);
              setModuleTimings(null);
              setLoading(false);
              setWalletData(null);
              setTransactionData(null);
              setGlitchData(null);
              setWalletError("");
              setTransactionError("");
              setGlitchError("");
              setStatus("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !loading) {
                analyzeWallet();
              }
            }}
            placeholder="Enter a public Solana wallet address"
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginTop: 0,
              padding: "15px",
              background: "#090909",
              border: "1px solid #444",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "15px"
            }}
          />

          <button
            onClick={analyzeWallet}
            disabled={loading}
            style={{
              width: "100%",
              marginTop: 0,
              padding: "16px",
              background: loading
                ? "#555"
                : "#c92a2a",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: loading
                ? "wait"
                : "pointer"
            }}
          >
            {loading
              ? "ANALYZING..."
              : "ANALYZE WALLET"}
          </button>
          </div>
        </div>

        {analysisFinished && moduleTimings && (
          <p data-testid="analysis-timing" style={{ color: "#aaa", fontSize: "12px", marginTop: "12px" }}>
            Analysis time: {(moduleTimings.total / 1000).toFixed(1)}s · Wallet: {moduleTimings.wallet == null ? "n/a" : (moduleTimings.wallet / 1000).toFixed(1) + "s"} · Transactions: {moduleTimings.transactions == null ? "n/a" : (moduleTimings.transactions / 1000).toFixed(1) + "s"} · GLITCH: {moduleTimings.glitch == null ? "n/a" : (moduleTimings.glitch / 1000).toFixed(1) + "s"}
          </p>
        )}

        {loading && (
          <div className="doom-scan-panel" role="status" aria-live="polite" aria-label="Scanning wallet in progress">
            <img className="doom-scan-thumb" src="/doom404-mascot.png..jpeg" alt="" />
            <div className="doom-scan-content">
              <div className="doom-scan-title">SCANNING WALLET...</div>
              <div className="doom-scan-stage">{status || "Reading on-chain wallet activity..."}</div>
              <div className="doom-scan-track" aria-label="Analysis in progress, duration unknown"><div className="doom-scan-indeterminate" /></div>
            </div>
          </div>
        )}

        {analysisFinished && !loading && (
          <p role="status" style={{ color: signalReady ? "#6cecb4" : "#ffb86b", fontSize: "13px", marginTop: "12px" }}>
            {signalReady
              ? "Signal ready — preliminary activity score supported by observed coverage."
              : walletError || !walletData
                ? "Analysis failed — wallet information could not be retrieved. Please retry."
                : emptyWallet
                  ? "Analysis complete — no observable transaction history. Insufficient evidence for a behavioral signal."
                  : hasModuleError
                    ? "Wallet overview complete — some optional intelligence modules are unavailable. Available results are shown below."
                    : "Analysis complete — wallet history or scoring coverage is insufficient for a behavioral signal."}
          </p>
        )}

        {status && !loading && !analysisFinished && (
          <div
            role="status"
            style={{
              ...cardStyle,
              color: "#ddd"
            }}
          >
            {status}
          </div>
        )}

        {walletAnalysisComplete && (
        <div key={requestVersion.current} id="wallet-results">
        {emptyWallet && <p role="status" style={{ color: "#ffb86b", fontSize: "14px" }}>New or inactive wallet: no observable transactions in the queried history. Behavioral scoring is unavailable; this is not a wallet safety assessment.</p>}
        <section aria-label="DOOM404 Trust Report" style={{ ...cardStyle, borderColor: "#633", marginBottom: 18 }}>
          <p style={{ color: "#ff7777", fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>DOOM404 // TRUST REPORT · EARLY ACCESS</p>
          <h2 style={{ fontSize: 26, margin: "8px 0" }}>Decision: Further verification required</h2>
          <p style={{ color: "#ddd", lineHeight: 1.65 }}>This scan cannot establish whether this wallet is safe or malicious. Do not treat an absence of detected indicators as clearance to transfer funds.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, margin: "16px 0" }}>
            <div style={{ background: "#202020", padding: 14, borderRadius: 8 }}><small style={{ color: "#aaa" }}>Risk verdict</small><p style={{ fontWeight: 700, marginBottom: 0 }}>Not established</p></div>
            <div style={{ background: "#202020", padding: 14, borderRadius: 8 }}><small style={{ color: "#aaa" }}>Decoded evidence</small><p style={{ fontWeight: 700, marginBottom: 0 }}>{glitchDecoded} transactions</p></div>
            <div style={{ background: "#202020", padding: 14, borderRadius: 8 }}><small style={{ color: "#aaa" }}>Coverage</small><p style={{ fontWeight: 700, marginBottom: 0 }}>{glitchData?.evidence?.sampleCompleteness ? String(glitchData.evidence.sampleCompleteness).replaceAll("_", " ") : "Unverified"}</p></div>
          </div>
          <h3 style={{ marginBottom: 6 }}>What you can decide now</h3>
          <p style={{ color: "#ccc", lineHeight: 1.65 }}>You can inspect observed wallet activity and supporting transactions. You cannot yet rely on this report for malicious-address screening, creator history, token-launch behavior or a validated wallet risk grade.</p>
          <p style={{ color: "#ffbf86", lineHeight: 1.65 }}>Recommended next action: Verify the wallet owner and transaction purpose independently before sending funds. Expand GLITCH evidence and inspect transaction signatures below.</p>
          <p style={{ color: "#999", fontSize: 12 }}>This report uses current on-chain observations only. Threat intelligence and token-creator relationship checks are not yet connected.</p>
        </section>
        <Section title="GLITCH // Evidence Quality">
          {glitchEvidence ? (
            <>
              <p style={{ color: "#ddd" }}>
                Evidence: <strong>{String(glitchEvidence.confidence ?? "unavailable").replaceAll("_", " ")}</strong>
                {" · "}Coverage: {String(glitchEvidence.sampleCompleteness ?? "unavailable").replaceAll("_", " ")}
              </p>
              <p style={{ color: "#999", fontSize: "13px" }}>
                {glitchEvidence.decodedTransactions ?? "Unavailable"} transactions decoded; {glitchEvidence.unavailableTransactions ?? "Unavailable"} unavailable.
              </p>
              <ul style={{ color: "#ccc", lineHeight: 1.7 }}>
                {(glitchEvidence.observations || []).map((observation, index) => (
                  <li key={index}>{observation}</li>
                ))}
              </ul>
              <p style={{ color: "#999", fontSize: "12px" }}>{glitchEvidence.interpretation}</p>
            </>
          ) : (
            <div role="status" style={{ ...cardStyle, color: "#ffb86b" }}>
              <strong>Evidence unavailable — GLITCH analysis did not complete.</strong>
              <p>{glitchError || "No GLITCH evidence was returned. Please retry the analysis."}</p>
              <p style={{ color: "#aaa", fontSize: "12px" }}>Transaction decoding and transfer coverage cannot be assessed. This is not a wallet safety determination.</p>
            </div>
          )}
        </Section>

        <Section title="01 // Wallet Overview">
          {walletData ? (
            <>
              <div style={cardStyle}>
                <p>
                  <AddressLink
                    address={walletData.address}
                  />
                </p>

                <p style={{ color: "#888" }}>
                  Network:{" "}
                  {walletData.network || "mainnet-beta"}
                </p>
              </div>

              <div style={gridStyle}>
                <Metric
                  label="SOL BALANCE"
                  value={
                    walletData.balanceSOL ??
                    "Unavailable"
                  }
                  note="SOL"
                />

                <Metric
                  label="TRANSACTIONS RETRIEVED"
                  value={
                    coverage.transactionsRetrieved ??
                    walletData.transactionsAnalyzed ??
                    "Unavailable"
                  }
                />

                <Metric
                  label="ACTIVE DAYS OBSERVED"
                  value={
                    activity.activeDaysObserved ??
                    "Unavailable"
                  }
                />
              </div>
            </>
          ) : (
            <ErrorPanel
              message={
                walletError ||
                "Analyze a wallet to view its overview."
              }
            />
          )}
        </Section>

        <Section title="02 // Activity Intelligence">
          {walletData ? (
            <>
              <div style={gridStyle}>
                <Metric
                  label="LAST 7 DAYS"
                  value={
                    activity.transactions7d ??
                    "Unavailable"
                  }
                />

                <Metric
                  label="LAST 30 DAYS"
                  value={
                    activity.transactions30d ??
                    "Unavailable"
                  }
                />

                <Metric
                  label="LAST 90 DAYS"
                  value={
                    activity.transactions90d ??
                    "Unavailable"
                  }
                />
              </div>

              {weeklyActivity.length > 0 && (
                <div style={cardStyle}>
                  <h3>Weekly Transaction Activity</h3>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: "7px",
                      height: "140px",
                      marginTop: "22px"
                    }}
                  >
                    {weeklyActivity
                      .slice()
                      .reverse()
                      .map((item, index) => (
                        <div
                          key={index}
                          title={
                            "Week " +
                            item.week +
                            ": " +
                            item.transactions +
                            " transactions"
                          }
                          style={{
                            flex: 1,
                            height:
                              Math.max(
                                3,
                                (
                                  (Number(item.transactions) || 0) /
                                  maxWeeklyActivity
                                ) * 100
                              ) + "%",
                            background: "#c92a2a",
                            borderRadius: "4px 4px 0 0"
                          }}
                        />
                      ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <ErrorPanel
              message={
                walletError ||
                "Activity intelligence not loaded."
              }
            />
          )}
        </Section>

        <Section title="03 // Wallet Intelligence">
  {walletData ? (
    <>
      <div style={gridStyle}>
        <Metric
  label="MATURITY SCORE"
  value={
    walletData.intelligence?.maturityScore != null
      ? walletData.intelligence.maturityScore + " / 25"
      : walletData.intelligence?.scoringStatus === "insufficient_data"
        ? "Insufficient data for scoring"
        : "Unavailable"
  }
  note="Observed wallet age"
/>

<Metric
  label="CONSISTENCY SCORE"
  value={
    walletData.intelligence?.consistencyScore != null
      ? walletData.intelligence.consistencyScore + " / 30"
      : walletData.intelligence?.scoringStatus === "insufficient_data"
        ? "Insufficient data for scoring"
        : "Unavailable"
  }
  note="Observed activity consistency"
/>

<Metric
  label="PRELIMINARY WALLET SCORE"
  value={
    walletData.intelligence?.preliminaryScore != null
      ? walletData.intelligence.preliminaryScore +
        " / " +
        (walletData.intelligence.preliminaryMaxScore ?? 55)
      : walletData.intelligence?.scoringStatus === "insufficient_data"
        ? "Insufficient data for scoring"
        : "Unavailable"
  }
  note="Descriptive activity score only"
/>

<Metric
  label="OBSERVED WALLET AGE"
  value={
    walletData.intelligence?.observedAgeDays != null
      ? walletData.intelligence.observedAgeDays + " days"
      : "Unavailable"
  }
  note="Based on available transaction history"
/>

<Metric
  label="ACTIVE DAYS — LAST 90 DAYS"
  value={
    walletData.intelligence?.activeDays90d ?? "Unavailable"
  }
  note="Days with observed transaction activity"
/>
      </div>

      <div style={cardStyle}>
        <h3>Scoring Eligibility Explanation</h3>
        <p style={{ color: "#aaa", lineHeight: 1.7 }}>
          {walletData.intelligence?.scoringExplanation ||
            "Scoring eligibility information is not available from this response."}
        </p>
        {walletData.intelligence?.scoringReasons?.length > 0 && (
          <ul style={{ color: "#aaa", lineHeight: 1.7, paddingLeft: "22px" }}>
            {walletData.intelligence.scoringReasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        )}
        <p style={{ color: "#888", fontSize: "13px", lineHeight: 1.7 }}>
          Observation coverage: 7 days — {formatCoverage(walletData.dataCoverage?.coverage?.coverage7d)};
          {" "}30 days — {formatCoverage(walletData.dataCoverage?.coverage?.coverage30d)};
          {" "}90 days — {formatCoverage(walletData.dataCoverage?.coverage?.coverage90d)}.
        </p>
        <p style={{ color: "#888", fontSize: "13px", lineHeight: 1.7 }}>
          These are data coverage limitations, not fraud or safety assessments.
        </p>
      </div>

      <div style={cardStyle}>
        <h3>Wallet Intelligence Interpretation</h3>

        <p style={{ color: "#aaa", lineHeight: 1.7 }}>
          Maturity measures observed wallet age.
          Consistency measures how regularly the wallet
          has been active during the observed period.
        </p>

        <p style={{ color: "#aaa", lineHeight: 1.7 }}>
          These scores describe observable blockchain
          activity only. They do not establish whether
          a wallet is trustworthy, safe or fraudulent.
        </p>

        <p style={{ color: "#ff7777", fontSize: "13px" }}>
          DOOM404 // Preliminary Wallet Intelligence
        </p>
      </div>
    </>
  ) : (
    <ErrorPanel
      message={
        walletError ||
        "Analyze a wallet to view wallet intelligence."
      }
    />
  )}
</Section>
        <Section title="04 // Transaction Intelligence">
          {transactionData ? (
            <>
              <div style={gridStyle}>
                <Metric
                  label="TRANSACTIONS DECODED"
                  value={
                    transactionData.transactionsDecoded ?? 0
                  }
                />

                <Metric
                  label="FAILED TO DECODE"
                  value={
                    transactionData.failedToDecode ?? 0
                  }
                />

                <Metric
                  label="RPC RATE LIMITED"
                  value={
                    transactionData.rateLimited
                      ? "YES"
                      : "NO"
                  }
                />
              </div>

              <div style={cardStyle}>
                <h3>Transaction Categories</h3>

                {categories.length === 0 ? (
                  <p style={{ color: "#999" }}>
                    No classifications available.
                  </p>
                ) : (
                  categories.map(([name, count]) => (
                    <div
                      key={name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        padding: "12px 0",
                        borderBottom: "1px solid #333"
                      }}
                    >
                      <span>{name}</span>
                      <strong>{count}</strong>
                    </div>
                  ))
                )}
              </div>

              <div style={cardStyle}>
                <h3>Recent Transactions</h3>

                {(transactionData.transactions || []).map(
                  (transaction) => (
                    <div
                      key={transaction.signature}
                      style={{
                        padding: "16px 0",
                        borderBottom: "1px solid #333"
                      }}
                    >
                      <p style={{ color: "#ff7777" }}>
                        {transaction.category}
                      </p>

                      <p
                        style={{
                          color: "#999",
                          fontSize: "13px"
                        }}
                      >
                        {formatDate(
                          transaction.timestamp ||
                          (
                            transaction.blockTime
                              ? transaction.blockTime * 1000
                              : null
                          )
                        )}
                      </p>

                      <AddressLink
                        address={transaction.signature}
                        type="tx"
                      />
                    </div>
                  )
                )}
              </div>

              <div style={cardStyle}>
                <p>
                  Coverage:{" "}
                  {transactionData.dataCoverage?.status ||
                    "Limited sample"}
                </p>

                <p
                  style={{
                    color: "#999",
                    fontSize: "13px"
                  }}
                >
                  Classification is based on observed
                  program interactions. A system program
                  interaction is not necessarily a SOL transfer.
                </p>
              </div>
            </>
          ) : (
            <ErrorPanel
              message={
                transactionError ||
                "Transaction intelligence not loaded."
              }
            />
          )}
        </Section>

        <Section title="05 // Data Reliability">
          <div style={cardStyle}>
            <p>
              Wallet history retrieved:{" "}
              {coverage.transactionsRetrieved ??
                walletData?.transactionsAnalyzed ??
                "Unavailable"}
            </p>

            <p>
              Historical limit reached:{" "}
              {coverage.historyLimitReached === undefined
                ? "Not reported"
                : coverage.historyLimitReached
                ? "Yes"
                : "No"}
            </p>

            <p>
              Complete wallet history:{" "}
              {coverage.completeWalletHistory === true
                ? "Reported complete"
                : "Not independently verified"}
            </p>

            <p
              style={{
                color: "#999",
                fontSize: "13px",
                lineHeight: 1.7
              }}
            >
              Blockchain RPC history coverage is not
              independently guaranteed. Missing records
              may affect activity metrics and classifications.
            </p>
          </div>
        </Section>

        <HistoryExplorer key={walletData?.address || wallet.trim()} address={walletData?.address || wallet.trim()} />
        <DeepGlitchExplorer key={"deep-" + (walletData?.address || wallet.trim())} address={walletData?.address || wallet.trim()} />

        <Section title="06 // GLITCH Scanner">
          <div style={cardStyle}>
            <p
              style={{
                color: "#ff5555",
                fontWeight: "bold",
                letterSpacing: "1px"
              }}
            >
              GLITCH // SOL TRANSFER INTELLIGENCE
            </p>

            <p style={{ color: "#aaa", lineHeight: 1.7 }}>
              Analyse explicit SOL transfers, transaction
              counterparties and verifiable on-chain evidence.
            </p>
          </div>

          {glitchData ? (
            <>
              <div style={gridStyle}>
                <Metric
                  label="SOL RECEIVED"
                  value={formatNumber(
                    glitchSummary.incomingSOL,
                    9
                  )}
                  note={
                    (glitchSummary.incomingTransferCount == null ? "Unavailable" : glitchSummary.incomingTransferCount) +
                    " incoming transfers"
                  }
                />

                <Metric
                  label="SOL SENT"
                  value={formatNumber(
                    glitchSummary.outgoingSOL,
                    9
                  )}
                  note={
                    (glitchSummary.outgoingTransferCount == null ? "Unavailable" : glitchSummary.outgoingTransferCount) +
                    " outgoing transfers"
                  }
                />

                <Metric
                  label="UNIQUE COUNTERPARTIES"
                  value={
                    glitchSummary.uniqueCounterparties ?? "Unavailable"
                  }
                  note="Observed addresses"
                />

                <Metric
                  label="TRANSACTIONS DECODED"
                  value={
                    (glitchCoverage.transactionsDecoded ?? 0) +
                    " / " +
                    (glitchCoverage.signaturesRetrieved ?? 0)
                  }
                  note="Recent transaction sample"
                />
              </div>

              <div style={cardStyle}>
                <h3>GLITCH v0.6 // Wallet Behavior Intelligence</h3>
                <p style={{ color: "#aaa", lineHeight: 1.7 }}>
                  Frequency and concentration are based on the recent decoded
                  transaction sample, not the wallet's complete history.
                </p>
                <div style={gridStyle}>
                  <Metric
                    label="SAMPLED ACTIVE DAYS"
                    value={frequency.activeDaysInSample ?? "Unavailable"}
                    note="Days with timestamped decoded transactions"
                  />
                  <Metric
                    label="BUSIEST OBSERVED DAY"
                    value={frequency.busiestDay
                      ? frequency.busiestDay.count + " transactions"
                      : "Unavailable"}
                    note={frequency.busiestDay?.date || "No timestamped activity"}
                  />
                  <Metric
                    label="LONGEST OBSERVED GAP"
                    value={frequency.longestQuietPeriodHours != null
                      ? formatNumber(frequency.longestQuietPeriodHours, 2) + " hours"
                      : "Unavailable"}
                    note="Between sampled decoded transactions"
                  />
                  <Metric
                    label="TOP COUNTERPARTY SOL SHARE"
                    value={concentration.top1VolumeSharePercent != null
                      ? formatNumber(concentration.top1VolumeSharePercent, 2) + "%"
                      : "Unavailable"}
                    note="Share of observed explicit SOL transfer volume"
                  />
                  <Metric
                    label="TOP 3 SOL SHARE"
                    value={concentration.top3VolumeSharePercent != null
                      ? formatNumber(concentration.top3VolumeSharePercent, 2) + "%"
                      : "Unavailable"}
                    note="Share of observed explicit SOL transfer volume"
                  />
                  <Metric
                    label="TOP COUNTERPARTY INTERACTIONS"
                    value={concentration.top1InteractionSharePercent != null
                      ? formatNumber(concentration.top1InteractionSharePercent, 2) + "%"
                      : "Unavailable"}
                    note="Share of observed explicit SOL transfer interactions"
                  />
                </div>
                {frequency.dailyActivity?.length > 0 && (
                  <div style={{ marginTop: "20px" }}>
                    <h4>Observed Daily Transaction Frequency</h4>
                    {frequency.dailyActivity.map((day) => (
                      <div key={day.date} style={{
                        display: "flex", justifyContent: "space-between",
                        borderBottom: "1px solid #333", padding: "8px 0",
                        color: "#ccc", gap: "12px"
                      }}>
                        <span>{day.date}</span>
                        <strong>{day.count}</strong>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ color: "#999", fontSize: "13px", lineHeight: 1.7 }}>
                  These observations do not establish suspicious intent,
                  identity, wallet safety, or fraud. Sampling and incomplete
                  decoding can materially affect the results.
                </p>
              </div>

              <div style={cardStyle}>
                <h3>Counterparty Intelligence</h3>

                <p
                  style={{
                    color: "#999",
                    fontSize: "13px",
                    lineHeight: 1.7
                  }}
                >
                  Addresses ranked by observed SOL transfer
                  interactions. Repeated interactions are
                  not inherently suspicious.
                </p>

                {counterparties.length === 0 ? (
                  <p style={{ color: "#999" }}>
                    {glitchData.coverage?.transactionsDecoded === 0
                      ? "Counterparty analysis unavailable — no transaction details were decoded."
                      : "No SOL transfer counterparties found in the decoded sample."}
                  </p>
                ) : (
                  counterparties.map((item) => (
                    <div
                      key={item.address}
                      style={{
                        borderBottom: "1px solid #333",
                        padding: "16px 0"
                      }}
                    >
                      <AddressLink address={item.address} />

                      <p
                        style={{
                          color: "#ddd",
                          fontSize: "14px"
                        }}
                      >
                        Observed interactions:{" "}
                        <strong>{item.interactions}</strong>
                      </p>

                      <p
                        style={{
                          color: "#aaa",
                          fontSize: "13px"
                        }}
                      >
                        Received from address:{" "}
                        {formatNumber(item.incomingSOL, 9)} SOL
                      </p>

                      <p
                        style={{
                          color: "#aaa",
                          fontSize: "13px"
                        }}
                      >
                        Sent to address:{" "}
                        {formatNumber(item.outgoingSOL, 9)} SOL
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div style={cardStyle}>
                <h3>Observed SOL Transfers</h3>

                <p
                  style={{
                    color: "#999",
                    fontSize: "13px"
                  }}
                >
                  Transfer direction is relative to the
                  wallet being analysed.
                </p>

                {transfers.length === 0 ? (
                  <p style={{ color: "#999" }}>
                    {glitchData.coverage?.transactionsDecoded === 0
                      ? "SOL transfer analysis unavailable — no transaction details were decoded."
                      : "No explicit SOL transfers found in the decoded sample."}
                  </p>
                ) : (
                  transfers.map((transfer, index) => (
                    <div
                      key={
                        transfer.signature +
                        "-" +
                        index
                      }
                      style={{
                        borderBottom: "1px solid #333",
                        padding: "18px 0"
                      }}
                    >
                      <p
                        style={{
                          color:
                            transfer.direction === "incoming"
                              ? "#65d6a1"
                              : transfer.direction === "outgoing"
                              ? "#ff7777"
                              : "#aaa",
                          fontWeight: "bold"
                        }}
                      >
                        {String(
                          transfer.direction || "unknown"
                        ).toUpperCase()}
                        {" — "}
                        {formatNumber(
                          transfer.amountSOL,
                          9
                        )} SOL
                      </p>

                      <p
                        style={{
                          color: "#999",
                          fontSize: "13px"
                        }}
                      >
                        {formatDate(transfer.timestamp)}
                      </p>

                      <p
                        style={{
                          color: "#aaa",
                          fontSize: "13px"
                        }}
                      >
                        Counterparty:
                      </p>

                      <AddressLink
                        address={transfer.counterparty}
                      />

                      <p style={{ marginTop: "14px" }}>
                        <a
                          href={
                            "https://solscan.io/tx/" +
                            encodeURIComponent(
                              transfer.signature
                            )
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "#ff7777",
                            textDecoration: "none"
                          }}
                        >
                          View transaction evidence ↗️
                        </a>
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div style={cardStyle}>
                <h3>GLITCH Data Coverage</h3>

                <p>
                  Signatures retrieved:{" "}
                  {glitchCoverage.signaturesRetrieved ?? 0}
                </p>

                <p>
                  Transactions decoded:{" "}
                  {glitchCoverage.transactionsDecoded ?? 0}
                </p>

                <p>
                  Transactions unavailable:{" "}
                  {glitchCoverage.transactionsUnavailable ?? 0}
                </p>

                <p>
                  RPC rate limited:{" "}
                  {glitchCoverage.rateLimited
                    ? "Yes"
                    : "No"}
                </p>

                <p
                  style={{
                    color: "#aaa",
                    fontSize: "13px",
                    lineHeight: 1.7
                  }}
                >
                  Analysis covers only the recent sampled
                  transactions. It is not a complete
                  wallet transaction history.
                </p>

                <p
                  style={{
                    color: "#aaa",
                    fontSize: "13px",
                    lineHeight: 1.7
                  }}
                >
                  Only explicit parsed System Program
                  transfers are included. Transaction
                  fees, rent changes, wrapped SOL and
                  SPL token transfers are not included.
                </p>

                <p
                  style={{
                    color: "#ff7777",
                    fontSize: "13px",
                    lineHeight: 1.7
                  }}
                >
                  GLITCH Scanner v0.6.0 is an observational
                  analytics tool. No fraud or wallet safety
                  determination is made.
                </p>
              </div>
            </>
          ) : (
            <ErrorPanel
              message={
                glitchError ||
                "Run an analysis to load GLITCH Scanner."
              }
            />
          )}
        </Section>

        </div>
        )}
        {walletAnalysisComplete && <footer
          style={{
            marginTop: "70px",
            paddingTop: "20px",
            borderTop: "1px solid #333",
            color: "#777",
            fontSize: "13px",
            lineHeight: 1.7
          }}
        >
          <strong>
            DOOM404 // Wallet Signal v1.0
          </strong>

          <p>
            Powered by public Solana blockchain data.
            No wallet connection or private keys required.
          </p>

          <p>
            Higher. Stronger. Together.
          </p>
        </footer>}
        </div>}
      </div>
    </main>
  );
}
