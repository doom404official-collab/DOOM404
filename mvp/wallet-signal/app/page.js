"use client";

import { useEffect, useState } from "react";

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


function MascotDisplay({ loading, complete }) {
  const mode = loading ? "analysing" : complete ? "signal-ready" : "getting-ready";
  const [active, setActive] = useState(false);
  const [readyLabelVisible, setReadyLabelVisible] = useState(false);
  useEffect(() => {
    if (!complete || loading) {
      setReadyLabelVisible(false);
      return;
    }
    const timer = setTimeout(() => setReadyLabelVisible(true), 1100);
    return () => clearTimeout(timer);
  }, [complete, loading]);
  return (
    <div
      className={"doom-mascot doom-mascot--" + mode + (active ? " doom-mascot--active" : "")}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onClick={() => setActive((value) => !value)}
      role="img"
      aria-label={"Original DOOM404 mascot, " + mode.replaceAll("-", " ")}
    >
      <div className="doom-mascot__art">
        <img
          className="doom-mascot__original"
          src="/doom404-mascot.png..jpeg"
          alt=""
          width="440"
          height="440"
        />
        <div className="doom-mascot__light" aria-hidden="true" />
        <div className="doom-mascot__scan" aria-hidden="true" />
        <div className="doom-mascot__sparkles" aria-hidden="true" />
      </div>
      <div className="doom-mascot__indicator" aria-live="polite">
        {loading ? "SCANNING" : complete ? (readyLabelVisible ? "✓ SIGNAL READY" : "SIGNAL LOCKED") : active ? "HELLO, BUILDER" : "SYSTEM READY"}
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
        padding: "28px 20px 50px",
        fontFamily: "Arial, sans-serif"
      }}
    >

      <style>{`
        .doom-hero { display:grid;grid-template-columns:minmax(0, 0.9fr) minmax(0, 1.1fr);align-items:center;gap:clamp(20px,3vw,48px);min-height:0;padding:24px 0 36px;position:relative;isolation:isolate }
.doom-hero > * {min-width:0}
@media (min-width:701px) {
  .doom-hero {min-height:0;padding:4px 0 8px;gap:clamp(16px,2.5vw,32px)}
  .doom-hero__copy {padding:0}
  .doom-hero__title {font-size:clamp(42px,5vw,66px)!important;margin:16px 0 12px!important}
  .doom-hero__description {font-size:clamp(16px,1.35vw,19px);line-height:1.5!important}
  .doom-mascot {max-width:410px;aspect-ratio:1.35}
  .doom-wallet-form {margin-top:0;padding:16px 22px}
  .doom-wallet-form__row {margin-top:10px}
  .doom-wallet-form__input,.doom-wallet-form__button {padding:14px 18px}
}
@media (min-width:701px) and (max-height:800px) {
  .doom-mascot {max-width:355px}
  .doom-hero__title {font-size:clamp(40px,4.5vw,58px)!important}
  .doom-hero__description {font-size:16px}
  .doom-hero {padding:0 0 6px}
}
@media (min-width:701px) and (max-width:1100px) {.doom-hero{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;padding:16px 0 28px}.doom-hero__title{font-size:clamp(46px,5.5vw,68px)!important}.doom-mascot{max-width:460px!important}}
.doom-hero::before {content:"";position:absolute;z-index:-1;inset:-35px -20px -15px 25%;background:radial-gradient(ellipse at 60% 50%,#ad0b2633,transparent 70%);pointer-events:none}
.doom-hero__copy {position:relative;z-index:2;padding:25px 0 40px}
.doom-hero__title {font-size:clamp(54px,6.5vw,90px)!important;line-height:1.02;letter-spacing:-2px;margin:34px 0 20px!important}
.doom-hero__description {font-size:clamp(17px,1.7vw,23px);max-width:410px;line-height:1.65!important}
.doom-wallet-form {margin-top:12px;position:relative;z-index:3;background:#131315eb;border:1px solid #444;border-radius:16px;padding:24px 28px}
.doom-wallet-form__row {display:flex;gap:16px;align-items:stretch;margin-top:14px}
.doom-wallet-form__input {flex:1;min-width:0;box-sizing:border-box;padding:18px 20px;background:#090909;border:1px solid #444;border-radius:9px;color:white;font-size:17px}
.doom-wallet-form__button {flex:0 0 30%;min-width:180px;padding:18px;background:#d62b35;color:white;border:0;border-radius:9px;font-weight:700;font-size:16px;cursor:pointer}
.doom-wallet-form__button:disabled {background:#555;cursor:wait}
.doom-scan-panel {margin-top:16px;display:flex;align-items:center;gap:20px;padding:20px 24px;background:linear-gradient(110deg,#19080e,#0c090a);border:1px solid #a42d40;border-radius:16px;box-shadow:0 0 30px #a500201a}
.doom-scan-panel__icon {width:85px;height:85px;object-fit:cover;border-radius:12px}
.doom-scan-panel__content {flex:1;min-width:0}
.doom-scan-panel__title {color:#ff4c5e;font-size:17px;font-weight:700;letter-spacing:1px}
.doom-scan-panel__subtitle {color:#aaa;margin-top:6px;font-size:14px}
.doom-scan-panel__track {margin-top:18px;height:9px;background:#3d2027;border-radius:999px;overflow:hidden}
.doom-scan-panel__bar {width:35%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#b71e35,#ff4759,#ffabb2);box-shadow:0 0 14px #ff364c;animation:doom-progress 1.7s ease-in-out infinite alternate}
@keyframes doom-progress {from{transform:translateX(-90%)}to{transform:translateX(280%)}}
        .doom-mascot { position: relative; width: 100%; max-width: 540px; aspect-ratio: 1.23; margin: 0 auto; isolation: isolate; cursor: pointer; perspective: 850px; }
        .doom-mascot__art { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 0; transform-origin: 50% 75%; animation: doom-breathe 5.2s ease-in-out infinite; transition: filter .35s ease; -webkit-mask-image: radial-gradient(ellipse 83% 78% at 50% 50%, #000 38%, #000b 65%, transparent 95%); mask-image: radial-gradient(ellipse 83% 78% at 50% 50%, #000 38%, #000b 65%, transparent 95%); }
        .doom-mascot__original { width: 100%; height: 100%; object-fit: contain; display: block; mix-blend-mode: screen; }
        .doom-mascot__light { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 55% 48%, #ff35441b, transparent 58%); animation: doom-glow 4.2s ease-in-out infinite; }
        .doom-mascot__scan { position: absolute; display: none; left: 7%; right: 7%; top: 0; height: 25%; pointer-events: none; background: linear-gradient(to bottom, transparent, #ff30491a 40%, #ff47624d 82%, #ff9ba8 96%, transparent); filter: drop-shadow(0 0 12px #ff3049); animation: doom-sweep 2.2s ease-in-out infinite alternate; }
        .doom-mascot__sparkles { position: absolute; inset: 0; pointer-events: none; opacity: 0; background: radial-gradient(circle at 22% 25%, #6cecb4 0 2px, transparent 4px), radial-gradient(circle at 82% 35%, #6cecb4 0 3px, transparent 5px), radial-gradient(circle at 68% 72%, #6cecb4 0 2px, transparent 4px); }
        .doom-mascot--analysing .doom-mascot__scan { display: block; }
        .doom-mascot--analysing .doom-mascot__art { animation: doom-focus 3.6s ease-in-out infinite; }
        .doom-mascot--signal-ready .doom-mascot__sparkles { opacity: 1; animation: doom-celebrate 2.4s ease-in-out infinite; }
        .doom-mascot--signal-ready .doom-mascot__art { filter: drop-shadow(0 0 12px #36d38a33); }
        .doom-mascot--active .doom-mascot__art, .doom-mascot:hover .doom-mascot__art { filter: brightness(1.13); }
        .doom-mascot__indicator { position: absolute; z-index: 4; bottom: 0; left: 50%; transform: translateX(-50%); background: #101010eb; color: #ff707b; border: 1px solid #8c2935; border-radius: 999px; padding: 7px 13px; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; white-space: nowrap; }
        .doom-mascot--signal-ready .doom-mascot__indicator { color: #6cecb4; border-color: #287f56; }
        @keyframes doom-breathe { 0%,100% { transform: translateY(0) rotate(-.5deg) scale(1); } 50% { transform: translateY(-4px) rotate(.6deg) scale(1.012); } }
        @keyframes doom-focus { 0%,100% { transform: rotate(-.5deg) scale(1); } 50% { transform: rotate(.5deg) scale(1.018); } }
        @keyframes doom-glow { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
        @keyframes doom-sweep { from { transform: translateY(0); } to { transform: translateY(310%); } }
        @keyframes doom-celebrate { 0%,100% { opacity: .25; transform: scale(.95); } 50% { opacity: 1; transform: scale(1.08); } }
        @media(max-width:700px){.doom-hero{grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);min-height:360px;gap:0;padding:0}.doom-hero__copy{padding:20px 0}.doom-hero__title{font-size:clamp(38px,8vw,55px)!important;letter-spacing:-1px;margin:24px 0 18px!important}.doom-hero__description{font-size:14px}.doom-mascot{width:125%;max-width:none;margin-left:-16%;aspect-ratio:.85}.doom-mascot__indicator{font-size:8px;padding:5px 8px;letter-spacing:.5px;bottom:13%}.doom-wallet-form{margin-top:4px;padding:20px}.doom-wallet-form__row{flex-direction:column;gap:12px}.doom-wallet-form__button{flex:auto;min-width:0}.doom-scan-panel{padding:15px;gap:12px}.doom-scan-panel__icon{width:58px;height:58px}.doom-scan-panel__title{font-size:14px}.doom-scan-panel__subtitle{font-size:12px}}
        /* Final desktop overrides: placed last to win over earlier hero rules. */
        @media (min-width:701px) {
          .doom-hero {min-height:0!important;padding:0 0 8px!important;gap:20px!important;align-items:center}
          .doom-hero__copy {padding:0!important}
          .doom-hero__title {font-size:clamp(38px,4.3vw,58px)!important;margin:12px 0 10px!important;line-height:1.06}
          .doom-hero__description {font-size:clamp(15px,1.25vw,18px)!important;line-height:1.45!important;margin:0}
          .doom-mascot {max-width:320px!important;aspect-ratio:1.3!important}
          .doom-wallet-form {margin-top:0!important;padding:14px 20px!important}
          .doom-wallet-form__row {margin-top:8px!important}
          .doom-wallet-form__input,.doom-wallet-form__button {padding:12px 16px!important}
        }
        @media (min-width:701px) and (max-height:800px) {
          .doom-mascot {max-width:285px!important}
          .doom-hero__title {font-size:clamp(36px,4vw,52px)!important}
          .doom-hero__description {font-size:15px!important}
          .doom-hero {padding-bottom:4px!important}
        }
        /* Balanced desktop sizing: larger hero while retaining the form above fold. */
        @media (min-width:701px) {
          .doom-hero {padding:12px 0 14px!important;gap:28px!important}
          .doom-hero__title {font-size:clamp(48px,5.2vw,72px)!important;margin:16px 0 14px!important}
          .doom-hero__description {font-size:clamp(17px,1.45vw,21px)!important;line-height:1.55!important}
          .doom-mascot {max-width:405px!important;aspect-ratio:1.3!important}
          .doom-wallet-form {padding:18px 24px!important}
          .doom-wallet-form__input,.doom-wallet-form__button {padding:15px 18px!important}
        }
        @media (min-width:701px) and (max-height:800px) {
          .doom-hero {padding:4px 0 8px!important}
          .doom-hero__title {font-size:clamp(44px,4.7vw,62px)!important}
          .doom-mascot {max-width:355px!important}
          .doom-wallet-form {padding:14px 20px!important}
          .doom-wallet-form__input,.doom-wallet-form__button {padding:12px 16px!important}
        }
        /* Restore immersive large mascot; reclaim height from whitespace, not artwork. */
        @media (min-width:701px) {
          .doom-hero {padding:0 0 0!important;gap:24px!important;align-items:center}
          .doom-hero__copy {padding:0!important}
          .doom-hero__title {font-size:clamp(48px,5.4vw,74px)!important;margin:8px 0 8px!important}
          .doom-hero__description {font-size:clamp(16px,1.4vw,20px)!important;line-height:1.45!important}
          .doom-mascot {max-width:490px!important;aspect-ratio:1.55!important}
          .doom-mascot__art {border-radius:0!important;-webkit-mask-image:radial-gradient(ellipse 94% 92% at 50% 48%,#000 46%,#000e 68%,transparent 99%)!important;mask-image:radial-gradient(ellipse 94% 92% at 50% 48%,#000 46%,#000e 68%,transparent 99%)!important}
          .doom-wallet-form {margin-top:-4px!important;padding:14px 20px!important}
          .doom-wallet-form__row {margin-top:8px!important}
          .doom-wallet-form__input,.doom-wallet-form__button {padding:12px 16px!important}
        }
        @media (min-width:701px) and (max-height:800px) {
          .doom-mascot {max-width:430px!important;aspect-ratio:1.65!important}
          .doom-hero__title {font-size:clamp(46px,4.9vw,65px)!important}
          .doom-hero__description {line-height:1.4!important}
        }
        /* Desktop mascot refinement: enlarge the original art, retain compact form layout. */
        @media (min-width:701px) {
          .doom-hero {overflow:visible!important}
          .doom-mascot {width:100%!important;max-width:520px!important;aspect-ratio:1.7!important;overflow:visible!important}
          .doom-mascot__art {overflow:visible!important;transform-origin:center center;-webkit-mask-image:radial-gradient(ellipse 99% 94% at 50% 50%,#000 55%,#000e 77%,transparent 100%)!important;mask-image:radial-gradient(ellipse 99% 94% at 50% 50%,#000 55%,#000e 77%,transparent 100%)!important}
          .doom-mascot__original {transform:scale(1.52)!important;transform-origin:center center}
          .doom-mascot__indicator {bottom:-4px}
        }
        @media (min-width:701px) and (max-height:800px) {
          .doom-mascot {max-width:470px!important;aspect-ratio:1.7!important}
          .doom-mascot__original {transform:scale(1.48)!important}
        }
        /* Desktop hero balance: large blended mascot, wallet form visible, overview below fold. */
        @media (min-width:701px) {
          .doom-hero {min-height:clamp(410px,57vh,510px)!important;padding:8px 0 16px!important;align-items:center!important;overflow:hidden!important}
          .doom-mascot {max-width:570px!important;aspect-ratio:1.36!important;overflow:visible!important}
          .doom-mascot__art {overflow:hidden!important;-webkit-mask-image:radial-gradient(ellipse 99% 96% at 50% 50%,#000 54%,#000e 76%,transparent 100%)!important;mask-image:radial-gradient(ellipse 99% 96% at 50% 50%,#000 54%,#000e 76%,transparent 100%)!important}
          /* Dissolve rectangular artwork edges into the dark hero without shrinking the robot. */
          .doom-mascot__art {
            -webkit-mask-image:radial-gradient(ellipse 72% 78% at 62% 49%,#000 37%,#000e 57%,#0008 76%,transparent 100%)!important;
            mask-image:radial-gradient(ellipse 72% 78% at 62% 49%,#000 37%,#000e 57%,#0008 76%,transparent 100%)!important;
          }
          .doom-mascot__original {transform:scale(1.22)!important}
          .doom-wallet-form {margin-top:0!important}
        }
        @media (min-width:701px) and (max-height:800px) {
          .doom-hero {min-height:clamp(380px,55vh,450px)!important;padding:4px 0 8px!important}
          .doom-mascot {max-width:525px!important;aspect-ratio:1.36!important}
          .doom-mascot__original {transform:scale(1.2)!important}
        }
        /* Fit the live scan status into the first desktop viewport. */
        @media (min-width:701px) {
          .doom-hero {min-height:clamp(315px,46vh,400px)!important;padding:0 0 4px!important}
          .doom-mascot {max-width:570px!important;aspect-ratio:1.55!important}
          .doom-wallet-form {padding:12px 20px!important}
          .doom-wallet-form__row {margin-top:7px!important}
          .doom-wallet-form__input,.doom-wallet-form__button {padding:12px 16px!important}
          .doom-scan-panel {margin-top:8px!important;padding:10px 16px!important;gap:12px!important}
          .doom-scan-panel__icon {width:56px!important;height:56px!important}
          .doom-scan-panel__track {margin-top:8px!important}
          .doom-scan-panel__subtitle {margin-top:2px!important}
        }
        @media (min-width:701px) and (max-height:800px) {
          .doom-hero {min-height:clamp(290px,44vh,355px)!important}
          .doom-mascot {max-width:530px!important;aspect-ratio:1.58!important}
        }
        /* The original mascot itself emits a soft green glow on success; no orbital ring. */
        .doom-mascot--signal-ready .doom-mascot__art {
          filter: drop-shadow(0 0 20px #38f79a9c) drop-shadow(0 0 45px #1cdb7970);
          animation: doom-success-glow 2.4s ease-in-out infinite;
        }
        .doom-mascot--signal-ready .doom-mascot__light {
          background: radial-gradient(ellipse at 52% 48%, #47ffac4d 0%, #30e88c22 45%, transparent 72%);
          animation: doom-success-light 2.4s ease-in-out infinite;
        }
        @keyframes doom-success-glow {
          0%,100% { filter: drop-shadow(0 0 12px #38f79a77) drop-shadow(0 0 32px #1cdb7950); }
          50% { filter: drop-shadow(0 0 24px #52ffc2cc) drop-shadow(0 0 54px #1cdb7999); }
        }
        @keyframes doom-success-light { 0%,100% {opacity:.65} 50% {opacity:1} }
        @media (prefers-reduced-motion: reduce) {
          .doom-mascot--signal-ready .doom-mascot__art,
          .doom-mascot--signal-ready .doom-mascot__light {animation:none}
        }
        @media (prefers-reduced-motion: reduce) { .doom-mascot__art, .doom-mascot__light, .doom-mascot__scan, .doom-mascot__sparkles { animation: none !important; } .doom-mascot__scan { display: none !important; } }
      `}</style>
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto"
        }}
      >

        <div className="doom-hero">
          <div className="doom-hero__copy">
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
    
            <h1 className="doom-hero__title"
              style={{
                fontSize: "clamp(36px, 7vw, 62px)",
                marginBottom: "12px"
              }}
            >
              Wallet Signal
            </h1>
    
            <p className="doom-hero__description"
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
          <MascotDisplay loading={loading} complete={!loading && status === "Analysis completed."} />
        </div>

        <div className="doom-wallet-form">
          <label
            htmlFor="wallet-address"
            style={{
              color: "#aaa",
              fontSize: "13px"
            }}
          >
            SOLANA WALLET ADDRESS
          </label>

          <div className="doom-wallet-form__row">
          <input className="doom-wallet-form__input"
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

          <button className="doom-wallet-form__button"
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
        </div>

        {status && (loading ? (
          <div className="doom-scan-panel" role="status" aria-live="polite">
            <img className="doom-scan-panel__icon" src="/doom404-mascot.png..jpeg" alt="" />
            <div className="doom-scan-panel__content">
              <div className="doom-scan-panel__title">SCANNING WALLET...</div>
              <div className="doom-scan-panel__subtitle">{status}</div>
              <div className="doom-scan-panel__track" role="progressbar" aria-label="Wallet analysis in progress"><div className="doom-scan-panel__bar" /></div>
            </div>
          </div>
        ) : <div role="status" style={{ ...cardStyle, color: "#ddd" }}>{status}</div>)}

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
