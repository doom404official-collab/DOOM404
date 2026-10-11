"use client";

import { useEffect, useRef, useState } from "react";
import { assessGlitchEvidence } from "../lib/glitchRiskIndicators.js";

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

function Section({ title, children }) {
  const [expanded, setExpanded] = useState(title.startsWith("01 //"));
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

export default function Home() {
  const [wallet, setWallet] = useState("");
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
        minHeight: analysisFinished ? "100vh" : "100dvh",
        height: analysisFinished && walletData && !walletError ? "auto" : "100dvh",
        overflowY: analysisFinished && walletData && !walletError ? "visible" : "hidden",
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
      </div>
    </main>
  );
}
