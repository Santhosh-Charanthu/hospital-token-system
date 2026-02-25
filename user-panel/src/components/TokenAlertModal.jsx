"use client";

import { useState, useEffect } from "react";
import { getFirebaseMessaging } from "../app/firebase";
import { getToken } from "firebase/messaging";
import { deleteToken } from "firebase/messaging";
import TokenRoller from "./TokenRoller";
import "../../styles/TokenAlertModal.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function TokenAlertModal({ open, onClose, activeToken }) {
  const [lastToken, setLastToken] = useState(null);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tokenNumber, setTokenNumber] = useState(null);

  useEffect(() => {
    if (activeToken && lastToken) {
      const suggested = Math.min(activeToken.tokenNumber + 3, lastToken);
      setTokenNumber(suggested);
    }
  }, [activeToken, lastToken]);

  useEffect(() => {
    if (!open) return;

    const fetchLastToken = async () => {
      try {
        setLoadingTokens(true);

        const res = await fetch(`${BASE_URL}/api/tokens/last-generated`);
        const data = await res.json();

        setLastToken(data.lastGeneratedToken.tokenNumber);
      } catch (err) {
        console.error("Failed to fetch last token", err);
      } finally {
        setLoadingTokens(false);
      }
    };

    fetchLastToken();
  }, [open]);

  if (!open) return null;

  const subscribe = async () => {
    setMessage("");

    if (tokenNumber === null) {
      setMessage("Please select your token using the roller");
      return;
    }

    if (activeToken && tokenNumber < activeToken.tokenNumber) {
      setMessage("This token has already passed");
      return;
    }

    try {
      setLoading(true);

      // Ask permission
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage("Notification permission denied");
        setLoading(false);
        return;
      }

      // // register the real service worker
      // const registration = await navigator.serviceWorker.register(
      //   "/firebase-messaging-sw.js",
      // );

      // // ensure ready
      // await navigator.serviceWorker.ready;

      // // Get FCM token
      // const messaging = await getFirebaseMessaging();
      // const deviceToken = await getToken(messaging, {
      //   vapidKey:
      //     "BPax7CFWCKoKcy2t-ywwPge0uNO0V38v6-y0DESVYVrSPrTGYvs_LaKMJBaPsDfBoAIUN-wuuP2ZGtQSIo7uDzc",
      //   serviceWorkerRegistration: registration,
      // });

      const messaging = await getFirebaseMessaging();

      /* WAIT UNTIL WORKER CONTROLS THE PAGE */
      let registration = await navigator.serviceWorker.ready;

      // VERY IMPORTANT (this is the real fix)
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            resolve,
            { once: true },
          );
        });
      }

      /* REMOVE OLD GHOST TOKEN */
      await deleteToken(messaging);

      /* NOW create REAL token */
      const deviceToken = await getToken(messaging, {
        vapidKey:
          "BPax7CFWCKoKcy2t-ywwPge0uNO0V38v6-y0DESVYVrSPrTGYvs_LaKMJBaPsDfBoAIUN-wuuP2ZGtQSIo7uDzc",
        serviceWorkerRegistration: registration,
      });

      // Send to backend
      const res = await fetch(`${BASE_URL}/api/tokens/token-alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceToken,
          tokenNumber: Number(tokenNumber),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessage("You will be notified before your turn.");
        setTimeout(onClose, 1500);
      } else {
        setMessage("Subscription failed");
      }
    } catch (err) {
      console.error(err);
      setMessage("Something went wrong");
    }

    setLoading(false);
  };

  if (loadingTokens || !activeToken || !lastToken) {
    return (
      <div className="modal-overlay">
        <div className="modal-card">
          <h2>Token Alerts</h2>
          <p>Loading available tokens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>Token Alerts</h2>
        <p>
          Enter your token number. We will notify you when 3 patients are ahead
          of you.
        </p>

        <TokenRoller
          startToken={activeToken.tokenNumber}
          endToken={lastToken}
          defaultValue={activeToken.tokenNumber}
          onSelect={(val) => setTokenNumber(val)}
        />

        {message && <p className="modal-message">{message}</p>}

        <div className="modal-actions">
          <button onClick={onClose} className="cancel-btn">
            Cancel
          </button>

          <button
            onClick={subscribe}
            className="subscribe-btn"
            disabled={loading}
          >
            {loading ? "Subscribing..." : "Enable Alerts"}
          </button>
        </div>
      </div>
    </div>
  );
}
