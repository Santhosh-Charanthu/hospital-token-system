"use client";

import { useEffect, useState } from "react";
import { PlusCircle, CheckCircle, Ticket, Activity } from "lucide-react";
import ConfirmResetModal from "../components/ConfirmResetModal";

import io from "socket.io-client";

// Create a single socket instance
const socket = io("http://localhost:5000");

export default function AdminPanel() {
  const [currentToken, setCurrentToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastGeneratedToken, setLastGeneratedToken] = useState(null);
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // 🔁 Fetch current state on refresh / first load
  const fetchCurrentToken = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/tokens/current");
      const data = await res.json();
      setCurrentToken(data.activeToken);
    } catch (err) {
      console.error("Failed to fetch current token", err);
    }
  };

  const fetchLastGeneratedToken = async () => {
    try {
      const res = await fetch(
        "http://localhost:5000/api/tokens/last-generated",
      );
      const data = await res.json();
      setLastGeneratedToken(data.lastGeneratedToken);
    } catch (err) {
      console.error("Failed to fetch last generated token", err);
    }
  };

  useEffect(() => {
    // Initial hydrate
    fetchCurrentToken();
    fetchLastGeneratedToken();

    // 🔥 Live updates from backend
    socket.on("TOKEN_UPDATE", (data) => {
      setCurrentToken(data.activeToken);
      setIsActionInProgress(false); // 🔓 unlock buttons
    });

    return () => {
      socket.off("TOKEN_UPDATE");
    };
  }, []);

  // const generateToken = async () => {
  //   if (isActionInProgress) return;
  //   setIsActionInProgress(true);
  //   try {
  //     const res = await fetch("http://localhost:5000/api/tokens/generate", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({}),
  //     });

  //     const data = await res.json();

  //     // Print immediately (UI will update via socket)
  //     if (data?.token) {
  //       // window.printer.printToken("TEST");

  //       if (window?.printer?.printToken) {
  //         await window.printer.printToken(data.token.tokenNumber);
  //         setLastGeneratedToken(data.token);
  //       } else {
  //         console.warn("Printer API not available");
  //       }
  //     }
  //   } catch (err) {
  //     alert("Failed to generate token");
  //     setIsActionInProgress(false); // fallback unlock
  //   }
  //   setLoading(false);
  // };

  const generateToken = async () => {
    if (isActionInProgress) return;
    setIsActionInProgress(true);

    try {
      const res = await fetch("http://localhost:5000/api/tokens/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      const tokenNumber = data?.token?.tokenNumber;

      if (!tokenNumber) throw new Error("Token generation failed");

      // 🖨 PRINT FIRST
      const result = await window.printer.printToken(tokenNumber);

      if (!result?.success) {
        throw new Error("Print failed");
      }

      // 🔥 ONLY NOW notify backend to emit TOKEN_UPDATE
      await fetch("http://localhost:5000/api/tokens/confirm-issued", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: data.token._id }),
      });

      // ✅ ONLY NOW update UI state
      setLastGeneratedToken(data.token);
    } catch (err) {
      console.error(err);
      alert("Token NOT issued because printing failed");
    } finally {
      setIsActionInProgress(false);
    }
  };

  const completeToken = async () => {
    if (isActionInProgress) return;

    setIsActionInProgress(true);
    try {
      await fetch("http://localhost:5000/api/tokens/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      // No manual state update needed — socket will handle it
    } catch (err) {
      alert("Failed to complete token");
      setIsActionInProgress(false); // fallback unlock
    }
    setLoading(false);
  };

  const resetTokens = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to reset all tokens? This action cannot be undone.",
    );

    if (!confirmed) return;

    setIsActionInProgress(true);

    try {
      await fetch("http://localhost:5000/api/tokens/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Reset local state immediately
      setCurrentToken(null);
      setLastGeneratedToken(null);
    } catch (err) {
      alert("Failed to reset tokens");
      setIsActionInProgress(false);
    }
  };

  const handleResetClick = () => {
    setShowResetModal(true);
  };

  const confirmResetTokens = async () => {
    setIsActionInProgress(true);

    try {
      await fetch("http://localhost:5000/api/tokens/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      setCurrentToken(null);
      setLastGeneratedToken(null);
      setShowResetModal(false);
    } catch (err) {
      alert("Failed to reset tokens");
      setIsActionInProgress(false);
    }
  };

  return (
    <main className="admin-container">
      <div className="admin-panel">
        <h1 className="admin-heading">Admin Panel</h1>

        <section className="token-section">
          <div className="current-token-box">
            <h2 className="section-title">Current Token</h2>
            <div className="token-display">
              {currentToken ? (
                <code className="token-code">{currentToken.tokenNumber}</code>
              ) : (
                <p className="no-token">No active token</p>
              )}
            </div>
          </div>

          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={generateToken}
              disabled={isActionInProgress}
            >
              Generate Token
            </button>

            <button
              className="btn btn-secondary"
              onClick={completeToken}
              disabled={isActionInProgress || !currentToken}
            >
              Complete Token
            </button>
          </div>
          <div className="button-group">
            <button
              className="btn btn-danger"
              onClick={handleResetClick}
              disabled={isActionInProgress}
            >
              Start Over
            </button>
          </div>
          <ConfirmResetModal
            open={showResetModal}
            onCancel={() => setShowResetModal(false)}
            onConfirm={confirmResetTokens}
            loading={isActionInProgress}
          />
        </section>

        <section className="last-token-section">
          <h2 className="section-title">Last Generated Token</h2>
          <div className="last-token-box">
            {lastGeneratedToken ? (
              <code className="token-code">
                {lastGeneratedToken.tokenNumber}
              </code>
            ) : (
              <p className="no-token">No token generated yet</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
