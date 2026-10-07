"use client";

import { useState } from "react";

export default function Home() {
  const [wallet, setWallet] = useState("");

  return (
    <main style={{
      minHeight: "100vh",
      background: "#080808",
      color: "#ffffff",
      padding: "60px 24px",
      fontFamily: "Arial, sans-serif"
    }}>
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
          onChange={(e) => setWallet(e.target.value)}
          style={{
            width: "100%",
            padding: "18px",
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            borderRadius: "8px",
            fontSize: "16px",
            boxSizing: "border-box"
          }}
        />

        <button
          style={{
            marginTop: "16px",
            padding: "16px 32px",
            background: "#e31b23",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          ANALYZE WALLET
        </button>

        <div style={{ marginTop: "60px", color: "#666" }}>
          Activity · Diversification · Trading · Maturity
        </div>

      </div>
    </main>
  );
}
