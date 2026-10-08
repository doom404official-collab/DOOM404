"use client";

import { useState } from "react";

const panelStyle = {
  background: "#141414",
  border: "1px solid #303030",
  borderRadius: "14px",
  padding: "22px",
  marginTop: "18px"
};

const labelStyle = {
  color: "#999",
  fontSize: "13px",
  marginBottom: "10px"
};

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString();
}

function MetricCard({ title, value, subtitle }) {
  return (
    <div style={panelStyle}>
      <p style={labelStyle}>{title}</p>

      <div
        style={{
          fontSize: "30px",
          fontWeight: "bold",
          color: "#ffffff",
          overflowWrap: "anywhere"
        }}
      >
        {value}
      </div>

      {subtitle && (
        <p
          style={{
            color: "#888",
            fontSize: "12px",
            marginTop: "10px"
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function CoverageBadge({ title, status }) {
  const labels = {
    complete_sample: "Sample covers period",
    rpc_exhausted: "RPC history exhausted",
    incomplete: "Incomplete",
    unknown: "Unknown"
  };

  const color =
    status === "complete_sample"
      ? "#55cc88"
      : status === "rpc_exhausted"
      ? "#e5b45a"
      : "#ff6666";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        padding: "14px 0",
        borderBottom: "1px solid #292929"
      }}
    >
      <span style={{ color: "#ddd" }}>
        {title}
      </span>

      <span
        style={{
          color,
          fontSize: "12px",
          textAlign: "right"
        }}
      >
        {labels[status] || "Unavailable"}
      </span>
    </div>
  );
}

function WeeklyChart({ data }) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <p style={{ color: "#888" }}>
        Weekly activity data unavailable.
      </p>
    );
  }

  const weeks = [...data].reverse();

  const max = Math.max(
    1,
    ...weeks.map((item) => item.transactions || 0)
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "6px",
          height: "180px",
          marginTop: "25px",
          borderBottom: "1px solid #444"
        }}
      >
        {weeks.map((item) => {
          const count = item.transactions || 0;

          const height =
            count === 0
              ? 3
              : Math.max(6, (count / max) * 100);

          return (
            <div
              key={item.week}
              title={
                "Week " +
                item.week +
                ": " +
                count +
                " transactions"
              }
              style={{
                flex: 1,
                height: height + "%",
                background: "#d62828",
                borderRadius: "4px 4px 0 0",
                minWidth: 0
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#888",
          fontSize: "11px",
          marginTop: "12px"
        }}
      >
        <span>12 weeks ago</span>
        <span>Current week</span>
      </div>

      <p
        style={{
          color: "#777",
          fontSize: "12px",
          marginTop: "15px"
        }}
      >
        Transaction counts are based on retrieved
        signatures. Missing history may affect results.
      </p>
    </div>
  );
}

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletData, setWalletData] = useState(null);

  async function analyzeWallet() {
    const address = wallet.trim();

    if (!address) {
      setStatus("Please enter a Solana wallet address.");
      setWalletData(null);
      return;
    }

    setLoading(true);
    setStatus("Retrieving Solana wallet history...");
    setWalletData(null);

    try {
      const response = await fetch(
        "/api/wallet?address=" +
          encodeURIComponent(address)
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to analyze wallet"
        );
      }

      setWalletData(result);
      setStatus("Wallet intelligence data loaded.");

    } catch (error) {
      console.error(error);

      setStatus(
        "Error: " +
          (error.message || "Unable to retrieve data")
      );

    } finally {
      setLoading(false);
    }
  }

  const activity = walletData?.activity || {};
  const coverage = walletData?.dataCoverage || {};
  const windows = coverage.coverage || {};

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080808",
        color: "#ffffff",
        padding: "45px 20px",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <div
        style={{
          maxWidth: "1050px",
          margin: "0 auto"
        }}
      >
        <header>
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
              fontSize: "clamp(34px, 7vw, 62px)",
              marginBottom: "12px"
            }}
          >
            Wallet Signal
          </h1>

          <p
            style={{
              color: "#aaa",
              fontSize: "17px",
              lineHeight: "1.6"
            }}
          >
            Explore observable Solana wallet activity
            through transparent blockchain intelligence.
          </p>

          <div
            style={{
              display: "inline-block",
              marginTop: "12px",
              padding: "8px 12px",
              border: "1px solid #663333",
              borderRadius: "6px",
              color: "#ff6666",
              fontSize: "12px"
            }}
          >
            MVP v0.2 // HISTORICAL INTELLIGENCE
          </div>
        </header>

        <section
          style={{
            ...panelStyle,
            marginTop: "35px"
          }}
        >
          <p style={labelStyle}>
            SOLANA WALLET ADDRESS
          </p>

          <input
            type="text"
            value={wallet}
            onChange={(event) =>
              setWallet(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && !loading) {
                analyzeWallet();
              }
            }}
            placeholder="Paste a public Solana wallet address"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "16px",
              background: "#090909",
              color: "#fff",
              border: "1px solid #444",
              borderRadius: "8px",
              fontSize: "15px"
            }}
          />

          <button
            onClick={analyzeWallet}
            disabled={loading}
            style={{
              marginTop: "18px",
              padding: "16px 24px",
              background: loading ? "#555" : "#cc2222",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: loading ? "wait" : "pointer",
              fontWeight: "bold",
              fontSize: "14px",
              width: "100%"
            }}
          >
            {loading
              ? "ANALYZING WALLET..."
              : "ANALYZE WALLET"}
          </button>

          <p
            style={{
              color: "#777",
              fontSize: "12px",
              marginTop: "15px"
            }}
          >
            Public wallet addresses only.
            Never enter a seed phrase or private key.
          </p>
        </section>

        {status && (
          <div
            role="status"
            style={{
              ...panelStyle,
              color: status.startsWith("Error")
                ? "#ff6666"
                : "#ddd"
            }}
          >
            {status}
          </div>
        )}

        {walletData && (
          <div style={{ marginTop: "35px" }}>
            <h2>01 // Wallet Overview</h2>

            <div style={panelStyle}>
              <p style={labelStyle}>
                WALLET ADDRESS
              </p>

              <p
                style={{
                  overflowWrap: "anywhere",
                  lineHeight: "1.6"
                }}
              >
                {walletData.address}
              </p>

              <p
                style={{
                  color: "#888",
                  fontSize: "13px"
                }}
              >
                Network: {walletData.network}
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px"
              }}
            >
              <MetricCard
                title="SOL BALANCE"
                value={
                  walletData.balanceSOL ?? "Unavailable"
                }
                subtitle="SOL"
              />

              <MetricCard
                title="TRANSACTIONS RETRIEVED"
                value={
                  walletData.transactionsAnalyzed ?? 0
                }
                subtitle="Retrieved transaction signatures"
              />

              <MetricCard
                title="ACTIVE DAYS OBSERVED"
                value={
                  activity.activeDaysObserved ?? "N/A"
                }
                subtitle="Across retrieved history"
              />
            </div>

            <h2 style={{ marginTop: "45px" }}>
              02 // Activity Intelligence
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px"
              }}
            >
              <MetricCard
                title="LAST 7 DAYS"
                value={activity.transactions7d ?? "N/A"}
                subtitle="Transactions observed"
              />

              <MetricCard
                title="LAST 30 DAYS"
                value={activity.transactions30d ?? "N/A"}
                subtitle="Transactions observed"
              />

              <MetricCard
                title="LAST 90 DAYS"
                value={activity.transactions90d ?? "N/A"}
                subtitle="Transactions observed"
              />
            </div>

            <div style={panelStyle}>
              <h3>Weekly Transaction Activity</h3>

              <WeeklyChart
                data={activity.weeklyActivity}
              />
            </div>

            <h2 style={{ marginTop: "45px" }}>
              03 // Wallet History
            </h2>

            <div style={panelStyle}>
              <p style={labelStyle}>
                EARLIEST OBSERVED ACTIVITY
              </p>

              <p>
                {formatDate(
                  activity.firstObservedTransaction
                )}
              </p>

              <p style={labelStyle}>
                LATEST OBSERVED ACTIVITY
              </p>

              <p>
                {formatDate(
                  activity.latestObservedTransaction
                )}
              </p>

              <p
                style={{
                  color: "#888",
                  fontSize: "12px"
                }}
              >
                Earliest observed activity is not
                necessarily the wallet creation date.
              </p>
            </div>

            <div style={panelStyle}>
              <p style={labelStyle}>
                LATEST TRANSACTION SIGNATURE
              </p>

              <p
                style={{
                  overflowWrap: "anywhere",
                  fontSize: "13px",
                  lineHeight: "1.7"
                }}
              >
                {walletData.latestTransaction ||
                  "No transactions found"}
              </p>
            </div>

            <h2 style={{ marginTop: "45px" }}>
              04 // Data Reliability
            </h2>

            <div style={panelStyle}>
              <CoverageBadge
                title="7-Day History"
                status={windows.coverage7d}
              />

              <CoverageBadge
                title="30-Day History"
                status={windows.coverage30d}
              />

              <CoverageBadge
                title="90-Day History"
                status={windows.coverage90d}
              />

              <p
                style={{
                  marginTop: "20px",
                  color: coverage.scoringEligible
                    ? "#55cc88"
                    : "#e5b45a",
                  fontWeight: "bold"
                }}
              >
                {coverage.scoringEligible
                  ? "INITIAL SCORING REQUIREMENTS MET"
                  : "INSUFFICIENT COVERAGE FOR SCORING"}
              </p>

              <p
                style={{
                  color: "#888",
                  fontSize: "12px",
                  lineHeight: "1.7"
                }}
              >
                Transactions retrieved:{" "}
                {coverage.transactionsRetrieved ?? "N/A"}
                <br />
                Pages fetched:{" "}
                {coverage.pagesFetched ?? "N/A"}
                <br />
                Historical limit reached:{" "}
                {coverage.historyLimitReached
                  ? "Yes"
                  : "No"}
                <br />
                Complete wallet history:{" "}
                {coverage.completeWalletHistory ||
                  "Not verified"}
              </p>

              <p
                style={{
                  color: "#999",
                  fontSize: "12px",
                  lineHeight: "1.6"
                }}
              >
                Coverage classifications describe the
                retrieved RPC sample. They do not
                independently guarantee complete
                blockchain history.
              </p>
            </div>

            <h2 style={{ marginTop: "45px" }}>
              05 // GLITCH Scanner
            </h2>

            <div
              style={{
                ...panelStyle,
                borderColor: "#663333"
              }}
            >
              <p
                style={{
                  color: "#ff5555",
                  fontWeight: "bold"
                }}
              >
                GLITCH SCANNER // IN DEVELOPMENT
              </p>

              <p
                style={{
                  color: "#aaa",
                  lineHeight: "1.7"
                }}
              >
                Future modules will examine observable
                transaction patterns, fund movements,
                and documented incident reports to
                highlight potential risks.
              </p>

              <p
                style={{
                  color: "#888",
                  fontSize: "12px"
                }}
              >
                No fraud or scam determination is
                currently performed.
              </p>
            </div>
          </div>
        )}

        <footer
          style={{
            marginTop: "80px",
            paddingTop: "25px",
            borderTop: "1px solid #292929",
            color: "#777",
            fontSize: "12px",
            lineHeight: "1.8"
          }}
        >
          DOOM404 // WALLET INTELLIGENCE
          <br />
          Public blockchain observations only.
          <br />
          No wallet connection or private keys required.
          <br />
          Activity metrics are not financial advice
          or proof of wallet trustworthiness.
        </footer>
      </div>
    </main>
  );
}
