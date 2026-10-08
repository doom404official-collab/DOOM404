 "use client";

import { useState } from "react";

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
    setStatus("Connecting to Solana mainnet...");
    setWalletData(null);

    try {
      const response = await fetch(
        `/api/wallet?address=${encodeURIComponent(address)}`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to analyze wallet"
        );
      }

      setWalletData(result);
      setStatus("Live Solana wallet data loaded successfully.");

    } catch (error) {
      console.error(error);

      setStatus(
        "Error: " +
        (error.message || "Unable to connect to Solana mainnet")
      );

    } finally {
      setLoading(false);
    }
  }

  const cardStyle = {
    background: "#151515",
    padding: "22px",
    borderRadius: "12px",
    border: "1px solid #333",
    marginTop: "18px"
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080808",
        color: "#ffffff",
        padding: "60px 24px",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto"
        }}
      >

        <p
          style={{
            color: "#ff4444",
            fontWeight: "bold"
          }}
        >
          DOOM404 // MVP v0.1
        </p>

        <h1
          style={{
            fontSize: "clamp(36px, 7vw, 64px)",
            marginBottom: "16px"
          }}
        >
          Wallet Signal
        </h1>

        <p
          style={{
            color: "#aaaaaa",
            fontSize: "18px"
          }}
        >
          Explore observable activity from a public Solana wallet.
        </p>

        <div style={{ marginTop: "40px" }}>

          <input
            type="text"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Enter Solana wallet address"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "16px",
              background: "#151515",
              color: "#ffffff",
              border: "1px solid #444",
              borderRadius: "8px",
              fontSize: "16px"
            }}
          />

          <button
            onClick={analyzeWallet}
            disabled={loading}
            style={{
              marginTop: "20px",
              padding: "16px 28px",
              background: loading ? "#555" : "#cc2222",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              cursor: loading ? "wait" : "pointer",
              fontWeight: "bold",
              fontSize: "15px"
            }}
          >
            {loading ? "ANALYZING..." : "ANALYZE WALLET"}
          </button>

        </div>

        {status && (
          <div
            role="status"
            style={{
              marginTop: "28px",
              padding: "16px",
              background: "#151515",
              borderRadius: "8px",
              color: status.startsWith("Error")
                ? "#ff5555"
                : "#dddddd"
            }}
          >
            {status}
          </div>
        )}

        {walletData && (
          <div style={{ marginTop: "35px" }}>

            <h2>Wallet Analysis</h2>

            <div style={cardStyle}>
              <h3>Wallet Address</h3>
              <p style={{ overflowWrap: "anywhere" }}>
                {walletData.address}
              </p>
            </div>

            <div style={cardStyle}>
              <h3>Network</h3>
              <p>{walletData.network || "Unknown"}</p>
            </div>

            <div style={cardStyle}>
              <h3>SOL Balance</h3>
              <p
                style={{
                  fontSize: "28px",
                  color: "#ff5555"
                }}
              >
                {walletData.balanceSOL ?? "Unavailable"} SOL
              </p>
            </div>

            <div style={cardStyle}>
              <h3>Transactions Analyzed</h3>
              <p style={{ fontSize: "28px" }}>
                {walletData.transactionsAnalyzed ?? 0}
              </p>
            </div>

            <div style={cardStyle}>
              <h3>Latest Transaction</h3>
              <p style={{ overflowWrap: "anywhere" }}>
                {walletData.latestTransaction || "No transactions found"}
              </p>
            </div>

            <div style={cardStyle}>
              <h3>DOOM404 Intelligence</h3>
              <p style={{ color: "#aaaaaa" }}>
                Wallet activity scoring, diversification,
                trading behaviour and maturity analysis
                are planned for future development.
              </p>
            </div>

          </div>
        )}

        <footer
          style={{
            marginTop: "80px",
            color: "#777",
            fontSize: "13px"
          }}
        >
          DOOM404 // Wallet Signal MVP
          <br />
          Public blockchain data only.
          No wallet connection or private keys required.
        </footer>

      </div>
    </main>
  );
}
