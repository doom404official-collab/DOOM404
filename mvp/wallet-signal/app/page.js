"use client";

import { useState } from "react";

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
        <div style={{ color: "#888", fontSize: "12px", marginTop: "8px" }}>
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

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletData, setWalletData] = useState(null);
  const [transactionData, setTransactionData] = useState(null);
  const [transactionError, setTransactionError] = useState("");

  async function analyzeWallet() {
    const address = wallet.trim();

    if (!address) {
      setStatus("Please enter a Solana wallet address.");
      return;
    }

    setLoading(true);
    setStatus("Connecting to Solana mainnet...");
    setWalletData(null);
    setTransactionData(null);
    setTransactionError("");

    try {
      const walletResponse = await fetch(
        "/api/wallet?address=" + encodeURIComponent(address)
      );

      const walletResult = await walletResponse.json();

      if (!walletResponse.ok) {
        throw new Error(
          walletResult.error || "Unable to analyze wallet"
        );
      }

      setWalletData(walletResult);
      setStatus("Wallet intelligence loaded.");

      try {
        const transactionResponse = await fetch(
          "/api/transactions?address=" + encodeURIComponent(address)
        );

        const transactionResult = await transactionResponse.json();

        if (!transactionResponse.ok) {
          throw new Error(
            transactionResult.error ||
            "Transaction intelligence unavailable"
          );
        }

        setTransactionData(transactionResult);
        setStatus("Wallet and transaction intelligence loaded.");

      } catch (error) {
        setTransactionError(error.message);
        setStatus(
          "Wallet loaded. Transaction intelligence is temporarily unavailable."
        );
      }

    } catch (error) {
      setStatus("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  const activity = walletData?.activity;
  const intelligence = walletData?.intelligence;
  const coverage = walletData?.dataCoverage;

  const categories = transactionData?.categories
    ? Object.entries(transactionData.categories)
    : [];

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
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>

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

        <h1 style={{ fontSize: "clamp(36px, 7vw, 62px)" }}>
          Wallet Signal
        </h1>

        <p style={{ color: "#aaa", lineHeight: 1.7 }}>
          Explore observable Solana wallet activity,
          transaction behaviour and transparent intelligence signals.
        </p>

        <div style={cardStyle}>
          <label
            htmlFor="wallet-address"
            style={{ color: "#aaa", fontSize: "13px" }}
          >
            SOLANA WALLET ADDRESS
          </label>

          <input
            id="wallet-address"
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
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
              background: loading ? "#555" : "#c92a2a",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: loading ? "wait" : "pointer"
            }}
          >
            {loading ? "ANALYZING..." : "ANALYZE WALLET"}
          </button>
        </div>

        {status && (
          <div
            role="status"
            style={{
              ...cardStyle,
              color: status.startsWith("Error") ? "#ff7777" : "#ddd"
            }}
          >
            {status}
          </div>
        )}

        {walletData && (
          <>
            <Section title="01 // Wallet Overview">
              <div style={cardStyle}>
                <p style={{ overflowWrap: "anywhere" }}>
                  {walletData.address}
                </p>
                <p style={{ color: "#888" }}>
                  Network: {walletData.network || "Unknown"}
                </p>
              </div>

              <div style={gridStyle}>
                <Metric
                  label="SOL BALANCE"
                  value={walletData.balanceSOL ?? "Unavailable"}
                  note="SOL"
                />
                <Metric
                  label="TRANSACTIONS RETRIEVED"
                  value={
                    coverage?.transactionsRetrieved ??
                    walletData.transactionsAnalyzed ??
                    0
                  }
                />
                <Metric
                  label="ACTIVE DAYS OBSERVED"
                  value={activity?.activeDaysObserved ?? "Unavailable"}
                />
              </div>
            </Section>

            <Section title="02 // Activity Intelligence">
              <div style={gridStyle}>
                <Metric
                  label="LAST 7 DAYS"
                  value={activity?.transactions7d ?? "Unavailable"}
                />
                <Metric
                  label="LAST 30 DAYS"
                  value={activity?.transactions30d ?? "Unavailable"}
                />
                <Metric
                  label="LAST 90 DAYS"
                  value={activity?.transactions90d ?? "Unavailable"}
                />
              </div>

              {Array.isArray(activity?.weeklyActivity) && (
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
                    {activity.weeklyActivity
                      .slice()
                      .reverse()
                      .map((item, index) => {
                        const max = Math.max(
                          1,
                          ...activity.weeklyActivity.map(
                            (week) => week.transactions
                          )
                        );

                        return (
                          <div
                            key={index}
                            title={
                              "Week " + item.week +
                              ": " + item.transactions + " transactions"
                            }
                            style={{
                              flex: 1,
                              height:
                                Math.max(
                                  3,
                                  (item.transactions / max) * 100
                                ) + "%",
                              background: "#c92a2a",
                              borderRadius: "4px 4px 0 0"
                            }}
                          />
                        );
                      })}
                  </div>
                </div>
              )}
            </Section>

            <Section title="03 // Wallet Intelligence">
              <div style={gridStyle}>
                <Metric
                  label="MATURITY SCORE"
                  value={
                    intelligence?.maturityScore ??
                    "Not available"
                  }
                />
                <Metric
                  label="CONSISTENCY SCORE"
                  value={
                    intelligence?.consistencyScore ??
                    "Not available"
                  }
                />
                <Metric
                  label="WALLET SCORE"
                  value={
                    intelligence?.score ??
                    intelligence?.walletScore ??
                    "Not available"
                  }
                />
              </div>

              <div style={cardStyle}>
                <p>
                  Classification:{" "}
                  <strong>
                    {intelligence?.disclaimer
                      ? "Behavioural analysis"
                      : "Observational only"}
                  </strong>
                </p>
                <p style={{ color: "#999", lineHeight: 1.6 }}>
                  Scores describe observed wallet behaviour,
                  not trustworthiness or fraud risk.
                </p>
              </div>
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
                        transactionData.rateLimited ? "YES" : "NO"
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
                          <p style={{ color: "#999", fontSize: "13px" }}>
                            {formatDate(transaction.timestamp)}
                          </p>
                          <a
                            href={
                              "https://solscan.io/tx/" +
                              transaction.signature
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "#ddd",
                              overflowWrap: "anywhere"
                            }}
                          >
                            {transaction.signature}
                          </a>
                        </div>
                      )
                    )}
                  </div>

                  <p style={{ color: "#888", fontSize: "13px" }}>
                    Coverage:{" "}
                    {transactionData.dataCoverage?.status ||
                      "Sample only"}
                    . Classification is based on a limited
                    transaction sample and does not establish fraud.
                  </p>
                </>
              ) : (
                <div style={cardStyle}>
                  <p style={{ color: "#aaa" }}>
                    {transactionError ||
                      "Transaction intelligence not loaded."}
                  </p>
                </div>
              )}
            </Section>

            <Section title="05 // Data Reliability">
              <div style={cardStyle}>
                <p>
                  Transactions retrieved:{" "}
                  {coverage?.transactionsRetrieved ??
                    walletData.transactionsAnalyzed ??
                    "Unavailable"}
                </p>
                <p>
                  Historical limit reached:{" "}
                  {coverage?.historyLimitReached
                    ? "Yes"
                    : "No"}
                </p>
                <p>
                  Complete wallet history:{" "}
                  {coverage?.completeWalletHistory ||
                    "Not independently verified"}
                </p>
                <p style={{ color: "#999", fontSize: "13px" }}>
                  RPC history coverage is not independently
                  guaranteed. Missing data may affect analysis.
                </p>
              </div>
            </Section>

            <Section title="06 // GLITCH Scanner">
              <div style={cardStyle}>
                <p style={{ color: "#ff7777" }}>
                  GLITCH SCANNER // IN DEVELOPMENT
                </p>
                <p style={{ color: "#aaa", lineHeight: 1.7 }}>
                  Planned: SOL and token transfer analysis,
                  counterparty patterns, unusual activity
                  detection and evidence-based warnings.
                </p>
                <p style={{ color: "#888", fontSize: "13px" }}>
                  No scammer determination is made by this version.
                </p>
              </div>
            </Section>
          </>
        )}

        <footer
          style={{
            marginTop: "70px",
            color: "#777",
            fontSize: "13px"
          }}
        >
          DOOM404 // Wallet Signal v0.4.2
          <p>
            Public blockchain data only.
            No wallet connection or private keys required.
          </p>
        </footer>
      </div>
    </main>
  );
}
