"use client";

import { useRef, useState } from "react";

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


function MascotDisplay({ loading, complete }) {
  const mode = loading ? "scanning" : complete ? "complete" : "idle";
  return (
    <div className={"doom-mascot doom-mascot--" + mode} aria-label={loading ? "DOOM404 robot scanning wallet" : complete ? "DOOM404 robot: preliminary signal ready" : "DOOM404 robot ready"}>
      <div className="doom-mascot__beam" aria-hidden="true" />
      <img
        className="doom-mascot__image"
        src="/doom404-mascot.png..jpeg"
        alt="DOOM404 official red-hooded robot mascot"
        width="440"
        height="440"
      />
      <div className="doom-mascot__indicator" aria-live="polite">
        {loading ? "SCANNING" : complete ? "✓ SIGNAL READY" : "SYSTEM READY"}
      </div>
    </div>
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

  async function analyzeWallet() {
    const address = wallet.trim();

    if (!address) {
      setStatus("Please enter a Solana wallet address.");
      return;
    }

    const version = ++requestVersion.current;
    setLoading(true);
    setAnalysisFinished(false);
    setStatus("Connecting to Solana Mainnet...");

    setWalletData(null);
    setTransactionData(null);
    setGlitchData(null);

    setWalletError("");
    setTransactionError("");
    setGlitchError("");

    try {
      setStatus("Loading wallet intelligence...");

      try {
        const result = await fetchModule(
          "/api/wallet",
          address
        );

        if (version !== requestVersion.current) return;
        setWalletData(result);
      } catch (error) {
        if (version !== requestVersion.current) return;
        setWalletError(error.message);
      }

      setStatus("Loading transaction intelligence...");

      try {
        const result = await fetchModule(
          "/api/transactions",
          address
        );

        if (version !== requestVersion.current) return;
        setTransactionData(result);
      } catch (error) {
        if (version !== requestVersion.current) return;
        setTransactionError(error.message);
      }

      setStatus("Running GLITCH Scanner...");

      try {
        const result = await fetchModule(
          "/api/glitch",
          address
        );

        if (version !== requestVersion.current) return;
        setGlitchData(result);
      } catch (error) {
        if (version !== requestVersion.current) return;
        setGlitchError(error.message);
      }

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
  const signalReady = walletAnalysisComplete && !hasModuleError &&
    walletData?.dataCoverage?.scoringEligible === true &&
    walletData?.intelligence?.scoringStatus === "preliminary";

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
        .doom-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(210px, 360px); align-items: center; gap: 24px; }
        .doom-mascot { position: relative; width: 100%; max-width: 360px; aspect-ratio: 1; isolation: isolate; perspective: 900px; margin: 0 auto; }
        .doom-mascot__image { position: relative; z-index: 2; display: block; width: 100%; height: 100%; object-fit: contain; border-radius: 0; filter: drop-shadow(0 16px 30px #d3192433); animation: doom-float 4.5s ease-in-out infinite; transform-style: preserve-3d; }
        .doom-mascot__beam { position: absolute; z-index: 3; inset: 12% 8%; border-top: 3px solid #ff4a5d; filter: drop-shadow(0 0 12px #ff304b); opacity: 0; pointer-events: none; }
        .doom-mascot--scanning .doom-mascot__beam { opacity: 1; animation: doom-scan 1.8s ease-in-out infinite alternate; }
        .doom-mascot__indicator { position: absolute; z-index: 4; bottom: 0; left: 50%; transform: translateX(-50%); background: #101010e8; color: #ff707b; border: 1px solid #8c2935; border-radius: 999px; padding: 7px 13px; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; white-space: nowrap; }
        .doom-mascot--complete .doom-mascot__image { filter: drop-shadow(0 0 24px #41f6a7ee) drop-shadow(0 0 55px #41f6a7bb) drop-shadow(0 0 85px #41f6a766); }
        .doom-mascot--complete .doom-mascot__indicator { color: #6cecb4; border-color: #287f56; }
        @keyframes doom-float { 0%,100% { transform: translateY(0) rotateY(-4deg) rotateX(2deg); } 50% { transform: translateY(-12px) rotateY(4deg) rotateX(-2deg); } }
        @keyframes doom-scan { from { transform: translateY(10%); } to { transform: translateY(85%); } }
        @media (max-width: 640px) { .doom-hero { grid-template-columns: minmax(0, 1fr) minmax(120px, 40%); gap: 8px; } .doom-mascot__indicator { font-size: 8px; padding: 5px 8px; letter-spacing: .5px; } }
        @media (max-width: 380px) { .doom-hero { grid-template-columns: minmax(0, 1fr) minmax(105px, 36%); gap: 6px; } .doom-mascot__indicator { letter-spacing: 0; } }
        .doom-scan-panel { display:flex; align-items:center; gap:16px; margin-top:16px; padding:14px 18px; border:1px solid #922b3f; border-radius:16px; background:linear-gradient(110deg,#220b12,#11090d 65%,#210911); box-shadow:0 0 22px #b91b3022; }
        .doom-scan-thumb { width:76px; height:76px; flex-shrink:0; object-fit:cover; border-radius:12px; }
        .doom-scan-content { flex:1; min-width:0; }
        .doom-scan-title { color:#ff5369; font-size:16px; font-weight:800; letter-spacing:1.3px; }
        .doom-scan-stage { color:#b8a5aa; margin:6px 0 13px; font-size:13px; }
        .doom-scan-track { height:10px; border-radius:999px; overflow:hidden; background:#46212c; }
        .doom-scan-indeterminate { width:34%; height:100%; border-radius:999px; background:linear-gradient(90deg,#a81735,#ff3b58,#ff9aa9); box-shadow:0 0 16px #ff365c99; animation:doom-scan-progress 1.7s ease-in-out infinite alternate; }
        @keyframes doom-scan-progress { from { transform:translateX(0); } to { transform:translateX(194%); } }
        @media (max-width:640px) { .doom-scan-panel { gap:12px; padding:12px; } .doom-scan-thumb { width:56px; height:56px; } .doom-scan-title { font-size:14px; } }
        @media (prefers-reduced-motion:reduce) { .doom-scan-indeterminate { animation:none; width:100%; opacity:.75; } }
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
          <MascotDisplay loading={loading} complete={signalReady} />
        </div>

        <div style={cardStyle}>
          <label
            htmlFor="wallet-address"
            style={{
              color: "#aaa",
              fontSize: "13px"
            }}
          >
            SOLANA WALLET ADDRESS
          </label>

          <input
            id="wallet-address"
            value={wallet}
            onChange={(event) => {
              requestVersion.current += 1;
              setWallet(event.target.value);
              setAnalysisFinished(false);
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
              marginTop: "12px",
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
              marginTop: "16px",
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
        {glitchEvidence && (
          <Section title="GLITCH // Evidence Quality">
            <p style={{ color: "#ddd" }}>
              Evidence: <strong>{String(glitchEvidence.confidence).replaceAll("_", " ")}</strong>
              {" · "}Coverage: {String(glitchEvidence.sampleCompleteness).replaceAll("_", " ")}
            </p>
            <p style={{ color: "#999", fontSize: "13px" }}>
              {glitchEvidence.decodedTransactions} transactions decoded; {glitchEvidence.unavailableTransactions} unavailable.
            </p>
            <ul style={{ color: "#ccc", lineHeight: 1.7 }}>
              {(glitchEvidence.observations || []).map((observation, index) => (
                <li key={index}>{observation}</li>
              ))}
            </ul>
            <p style={{ color: "#999", fontSize: "12px" }}>{glitchEvidence.interpretation}</p>
          </Section>
        )}

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
                    (glitchSummary.incomingTransferCount ?? 0) +
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
                    (glitchSummary.outgoingTransferCount ?? 0) +
                    " outgoing transfers"
                  }
                />

                <Metric
                  label="UNIQUE COUNTERPARTIES"
                  value={
                    glitchSummary.uniqueCounterparties ?? 0
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
                    No SOL transfer counterparties found
                    in this sample.
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
                    No explicit SOL transfers found
                    in this sample.
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
