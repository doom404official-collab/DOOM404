"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [walletData, setWalletData] = useState(null);

  async function analyzeWallet() {
    const address = wallet.trim();

    // Check that something has been entered
    if (!address) {
      setStatus("Please enter a Solana wallet address.");
      setWalletData(null);
      return;
    }

    // Validate Solana wallet address
    try {
      new PublicKey(address);
    } catch {
      setStatus("❌ Invalid Solana wallet address");
      setWalletData(null);
      return;
    }

    setLoading(true);
    setStatus("Connecting to Solana mainnet...");
    setWalletData(null);

    try {
      const response = await fetch(
        '/api/wallet?address=${encodeURIComponent(address)}'
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to analyze wallet");
      }

      setWalletData(result);
      setStatus("✓ Live Solana wallet data loaded");
    } catch (error) {
      console.error(error);
      setStatus(
        ❌ ${error.message || "Unable to connect to Solana mainnet"}
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 50% 40%, #260808 0%, #080808 45%, #030303 100%)",
        color: "#ffffff",
        padding: "60px 24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        <p
          style={{
            color: "#ef4444",
            fontWeight: "700",
            letterSpacing: "1px",
          }}
        >
          DOOM404 // MVP v0.1
        </p>

        <h1
          style={{
            fontSize: "56px",
            margin: "20px 0 10px",
          }}
        >
          Wallet Signal
        </h1>

        <p
          style={{
            color: "#aaaaaa",
            fontSize: "20px",
            marginBottom: "40px",
          }}
        >
          Explore observable activity from a public Solana wallet.
        </p>

        <input
          type="text"
          value={wallet}
          onChange={(event) => setWallet(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              analyzeWallet();
            }
          }}
          placeholder="Enter Solana wallet address"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "16px",
            fontSize: "16px",
            color: "#ffffff",
            background: "#111111",
            border: "1px solid #333333",
            borderRadius: "6px",
            outline: "none",
            marginBottom: "18px",
          }}
        />

        <button
          onClick={analyzeWallet}
          disabled={loading}
          style={{
            padding: "15px 28px",
            background: loading ? "#7f1d1d" : "#dc2626",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            fontWeight: "700",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "ANALYZING..." : "ANALYZE WALLET"}
        </button>

        {status && (
          <p
            style={{
              marginTop: "28px",
              fontSize: "16px",
            }}
          >
            {status}
          </p>
        )}

        {walletData && (
          <div
            style={{
              marginTop: "40px",
              padding: "24px",
              background: "#101010",
              border: "1px solid #292929",
              borderRadius: "10px",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: "24px",
              }}
            >
              Wallet Analysis
            </h2>

            <p>
              <strong>Network:</strong>{" "}
              {walletData.network || "Solana Mainnet"}
            </p>

            <p>
              <strong>SOL Balance:</strong>{" "}
              {walletData.balanceSOL ?? "N/A"}
            </p>

            <p>
              <strong>Transactions Analyzed:</strong>{" "}
              {walletData.transactionsAnalyzed ?? "N/A"}
            </p>

            <p>
              <strong>Latest Transaction:</strong>
            </p>

            <p
              style={{
                color: "#aaaaaa",
                wordBreak: "break-all",
                fontSize: "14px",
              }}
            >
              {walletData.latestTransaction || "No transaction found"}
            </p>

            <div
              style={{
                marginTop: "30px",
                paddingTop: "20px",
                borderTop: "1px solid #292929",
                color: "#777777",
              }}
            >
              Activity · Diversification · Trading · Maturity
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
