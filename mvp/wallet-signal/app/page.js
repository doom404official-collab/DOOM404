"use client";

import { useState } from "react";

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
  return (
    <section style={{ marginTop: "38px" }}>
      <h2 style={{ fontSize: "22px", marginBottom: "18px" }}>
        {title}
      </h2>
      {children}
    </section>
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


function DoomMascot({ loading, complete }) {
  return (
    <div className={"doom-mascot " + (loading ? "doom-scanning" : "")} role="img" aria-label={loading ? "DOOM404 robot scanning wallet" : "DOOM404 red-hooded robot mascot"}>
      <div className="doom-halo" />
      <div className="doom-robot">
        <svg viewBox="0 0 300 330" width="100%" height="100%" aria-hidden="true">
          <defs>
            <linearGradient id="hood3d" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff6767"/><stop offset=".45" stopColor="#c90020"/><stop offset="1" stopColor="#54000b"/>
            </linearGradient>
            <linearGradient id="visor3d" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#343b49"/><stop offset=".45" stopColor="#06070b"/><stop offset="1" stopColor="#000"/>
            </linearGradient>
          </defs>
          <ellipse cx="150" cy="307" rx="98" ry="13" fill="#9f0919" opacity=".35"/>
          <path d="M82 198 Q49 217 52 267 L92 281 L109 242 Z" fill="url(#hood3d)" stroke="#ff5960" strokeWidth="4"/>
          <path d="M218 198 Q251 217 248 267 L208 281 L191 242 Z" fill="url(#hood3d)" stroke="#ff5960" strokeWidth="4"/>
          <path d="M91 194 Q150 177 209 194 L226 284 Q150 308 74 284 Z" fill="url(#hood3d)" stroke="#ff5361" strokeWidth="5"/>
          <path d="M75 107 Q76 29 150 23 Q223 29 225 107 L239 181 Q217 219 150 221 Q83 219 61 181 Z" fill="url(#hood3d)" stroke="#ff6464" strokeWidth="6"/>
          <path d="M88 102 Q150 52 212 102 L220 175 Q205 201 150 206 Q95 201 80 175 Z" fill="#12141b" stroke="#f93c4e" strokeWidth="5"/>
          <rect x="88" y="112" width="124" height="77" rx="28" fill="url(#visor3d)" stroke="#656874" strokeWidth="5"/>
          <path d="M107 148 Q121 126 135 148 M165 148 Q179 126 193 148" fill="none" stroke="#ff414e" strokeWidth="9" strokeLinecap="round" className="doom-eyes"/>
          <path d="M101 119 Q123 109 142 112" stroke="#ffffff" strokeOpacity=".2" strokeWidth="5" fill="none"/>
          <circle cx="75" cy="145" r="13" fill="#1b1d26" stroke="#ff3349" strokeWidth="6"/>
          <circle cx="225" cy="145" r="13" fill="#1b1d26" stroke="#ff3349" strokeWidth="6"/>
          <text x="150" y="91" fill="#fff" fontWeight="900" fontSize="16" textAnchor="middle">DOOM404</text>
          <path d="M112 214 L188 214 L199 270 L101 270 Z" fill="#111319" stroke="#e42b3b" strokeWidth="3"/>
          <text x="150" y="255" fill="#fff" fontWeight="900" fontSize="35" textAnchor="middle">404</text>
          <rect x="48" y="259" width="44" height="35" rx="12" fill="#171820" stroke="#fb4150" strokeWidth="5"/>
          <rect x="208" y="259" width="44" height="35" rx="12" fill="#171820" stroke="#fb4150" strokeWidth="5"/>
        </svg>
      </div>
      {loading && <><div className="doom-scanline" /><div className="doom-orbit doom-orbit-one"/><div className="doom-orbit doom-orbit-two"/></>}
      {complete && !loading && <span className="doom-check">✓</span>}
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

    setLoading(true);
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

        setWalletData(result);
      } catch (error) {
        setWalletError(error.message);
      }

      setStatus("Loading transaction intelligence...");

      try {
        const result = await fetchModule(
          "/api/transactions",
          address
        );

        setTransactionData(result);
      } catch (error) {
        setTransactionError(error.message);
      }

      setStatus("Running GLITCH Scanner...");

      try {
        const result = await fetchModule(
          "/api/glitch",
          address
        );

        setGlitchData(result);
      } catch (error) {
        setGlitchError(error.message);
      }

      setStatus("Analysis completed.");

    } catch (error) {
      setStatus("Analysis error: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  const activity = walletData?.activity || {};
  const intelligence = walletData?.intelligence || {};
  const coverage = walletData?.dataCoverage || {};

  const categories = transactionData?.categories
    ? Object.entries(transactionData.categories)
    : [];

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
        minHeight: "100vh",
        background: "#080808",
        color: "#fff",
        padding: "50px 20px",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <div
        style={{
          maxWidth: "1050px",
          margin: "0 auto"
        }}
      >

        <style>{`
          .doom-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:260px;position:relative}
          .doom-hero-copy{flex:1;min-width:0;position:relative;z-index:2}
          .doom-status{color:#ff626c;font-weight:800;letter-spacing:2px;font-size:13px;line-height:1.7;margin-top:22px}
          .doom-mascot{width:min(37%,310px);min-width:165px;aspect-ratio:1/1.12;position:relative;perspective:800px;flex-shrink:0;filter:drop-shadow(0 12px 25px rgba(227,20,45,.27))}
          .doom-halo{position:absolute;inset:8% 5%;border:2px solid #e52940;border-radius:50%;box-shadow:0 0 24px #c91b35, inset 0 0 20px #9a1025;transform:rotateX(18deg);animation:doomHalo 7s ease-in-out infinite}
          .doom-robot{position:absolute;inset:2%;animation:doomFloat 3.7s ease-in-out infinite;transform-style:preserve-3d}
          .doom-robot svg{filter:drop-shadow(0 13px 9px rgba(0,0,0,.7))}
          .doom-scanning .doom-robot{animation:doomAnalyze 1.6s ease-in-out infinite}
          .doom-scanning .doom-eyes{animation:doomBlink .9s ease-in-out infinite}
          .doom-scanline{position:absolute;left:10%;right:10%;height:3px;top:15%;background:#ff5266;box-shadow:0 0 18px 5px rgba(255,30,62,.7);animation:doomScan 1.7s linear infinite;pointer-events:none}
          .doom-orbit{position:absolute;inset:3%;border:1px dashed rgba(255,83,101,.65);border-radius:50%;animation:doomSpin 5s linear infinite}
          .doom-orbit-two{inset:13%;animation-direction:reverse;animation-duration:3s}
          .doom-check{position:absolute;right:0;top:12%;color:#76e2b5;font-size:34px;font-weight:900;text-shadow:0 0 15px #1a8f66}
          @keyframes doomFloat{0%,100%{transform:translateY(0) rotateY(-8deg) rotateX(3deg)}50%{transform:translateY(-13px) rotateY(7deg) rotateX(-2deg)}}
          @keyframes doomAnalyze{0%,100%{transform:translateY(-4px) rotateY(-12deg) rotateZ(-2deg)}50%{transform:translateY(-15px) rotateY(12deg) rotateZ(2deg)}}
          @keyframes doomHalo{0%,100%{opacity:.6;transform:rotateX(18deg) scale(.97)}50%{opacity:1;transform:rotateX(18deg) scale(1.04)}}
          @keyframes doomBlink{0%,80%,100%{opacity:1}90%{opacity:.25}}
          @keyframes doomScan{0%{top:16%;opacity:0}15%{opacity:1}85%{opacity:1}100%{top:86%;opacity:0}}
          @keyframes doomSpin{to{transform:rotate(360deg)}}
          @media(min-width:750px){.doom-hero{min-height:340px}}
          @media(max-width:500px){.doom-hero{gap:2px;min-height:250px}.doom-mascot{min-width:125px;width:38%}.doom-hero-copy h1{font-size:clamp(30px,8vw,43px)!important}.doom-hero-copy p{font-size:13px;line-height:1.6}}
          @media(prefers-reduced-motion:reduce){.doom-mascot *, .doom-mascot{animation:none!important}}
        `}</style>
        <div className="doom-hero">
          <div className="doom-hero-copy">
            <p style={{color:"#ff555f",fontWeight:"bold",letterSpacing:"2px",fontSize:"12px"}}>DOOM404 // INTELLIGENCE SYSTEM</p>
            <h1 style={{fontSize:"clamp(36px, 7vw, 62px)",marginBottom:"12px"}}>Wallet Signal</h1>
            <p style={{color:"#aaa",lineHeight:1.7}}>Explore observable Solana wallet activity, transaction behaviour, SOL transfer flows and transparent intelligence signals.</p>
            <p className="doom-status">{loading ? "GLITCH SCANNER // ANALYZING" : walletData || transactionData || glitchData ? "ANALYSIS COMPLETE // SIGNALS READY" : "SYSTEM READY // AWAITING WALLET"}</p>
          </div>
          <DoomMascot loading={loading} complete={!loading && Boolean(walletData || transactionData || glitchData)} />
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
            onChange={(event) =>
              setWallet(event.target.value)
            }
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

        {status && (
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

        <footer
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
            DOOM404 // Wallet Signal v0.6.0
          </strong>

          <p>
            Powered by public Solana blockchain data.
            No wallet connection or private keys required.
          </p>

          <p>
            Higher. Stronger. Together.
          </p>
        </footer>
      </div>
    </main>
  );
}
