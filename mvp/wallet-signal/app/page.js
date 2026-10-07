"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function analyzeWallet() {
    const address = wallet.trim();

    setData(null);

    if (!address) {
      setStatus("Please enter a Solana wallet address.");
      return;
    }

    try {
      new PublicKey(address);
    } catch {
      setStatus("✕ Invalid Solana wallet address");
      return;
    }

    setLoading(true);
    setStatus("Connecting to Solana mainnet...");

    try {
      const response = await fetch(
        /api/wallet?address=${encodeURIComponent(address)}
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to analyze wallet");
      }

      setData(result);
      setStatus("✓ Live on-chain data retrieved");
    } catch (error) {
      setStatus(✕ ${error.message});
    } finally {
      setLoading(false);
    }
  }

  const cardStyle = {
    background: "#111",
    border: "1px solid #292929",
    borderRadius: "10px",
    padding: "20px",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080808",
        color: "#fff",
        padding: "60px 24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <p style={{ color: "#ff3030", fontWeight: "bold" }}>
          DOOM404 // MVP v0.1
        </p>

        <h1 style={{ fontSize: "48px", marginBottom: "10px" }}>
          Wallet Signal
        </h1>

        <p style={{ color: "#999", marginBottom: "40px" }}>
          Explore observable activity from a public Solana wallet.
        </p>

        <input
          type="text"
          placeholder="Enter Solana wallet address"
          value={wallet}
          onChange={(e) => {
            setWallet(e.target.value);
            setStatus("");
            setData(null);
          }}
          style={{
            width: "100%",
            padding: "18px",
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            borderRadius: "8px",
            fontSize: "16px",
            boxSizing: "border-box",
          }}
        />

        <button
          onClick={analyzeWallet}
          disabled={loading}
          style={{
            marginTop: "16px",
            padding: "16px 32px",
            background: loading ? "#661015" : "#e31b23",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "ANALYZING..." : "ANALYZE WALLET"}
        </button>

        {status && (
          <p style={{ marginTop: "22px", color: "#bbb" }}>
            {status}
          </p>
        )}

        {data && (
          <div style={{ marginTop: "40px" }}>
            <p style={{ color: "#ff3030", fontWeight: "bold" }}>
              LIVE WALLET DATA
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
              }}
            >
              <div style={cardStyle}>
                <div style={{ color: "#777", fontSize: "13px" }}>NETWORK</div>
                <div style={{ marginTop: "8px", fontWeight: "bold" }}>
                  Solana Mainnet
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ color: "#777", fontSize: "13px" }}>
                  SOL BALANCE
                </div>
                <div style={{ marginTop: "8px", fontWeight: "bold" }}>
                  {Number(data.balanceSOL).toFixed(8)} SOL
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ color: "#777", fontSize: "13px" }}>
                  RECENT TRANSACTIONS
                </div>
                <div style={{ marginTop: "8px", fontWeight: "bold" }}>
                  {data.transactionsAnalyzed}
                </div>
              </div>
            </div>

            <div style={{ ...cardStyle, marginTop: "12px" }}>
              <div style={{ color: "#777", fontSize: "13px" }}>
                WALLET
              </div>

              <div
                style={{
                  marginTop: "8px",
                  wordBreak: "break-all",
                  fontFamily: "monospace",
                }}
              >
                {data.address}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: "60px", color: "#666" }}>
          Activity · Diversification · Trading · Maturity
        </div>
      </div>
    </main>
  );
}
