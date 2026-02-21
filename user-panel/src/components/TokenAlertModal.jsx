"use client";

import { useState } from "react";
import { getFirebaseMessaging } from "../app/firebase";
import { getToken } from "firebase/messaging";
import "../../styles/TokenAlertModal.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function TokenAlertModal({ open, onClose, activeToken }) {
  const [tokenNumber, setTokenNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  if (!open) return null;

  const subscribe = async () => {
    setMessage("");

    if (!tokenNumber) {
      setMessage("Please enter a token number");
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

      // register the real service worker
      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
      );

      // ensure ready
      await navigator.serviceWorker.ready;

      // Get FCM token
      const messaging = await getFirebaseMessaging();
      const deviceToken = await getToken(messaging, {
        vapidKey:
          "BPax7CFWCKoKcy2t-ywwPge0uNO0V38v6-y0DESVYVrSPrTGYvs_LaKMJBaPsDfBoAIUN-wuuP2ZGtQSIo7uDzc",
        serviceWorkerRegistration: registration,
      });

      console.log(deviceToken);

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

      console.log(data);

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

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>Token Alerts</h2>
        <p>
          Enter your token number. We will notify you when 3 patients are ahead
          of you.
        </p>

        <input
          type="number"
          placeholder="Enter your token number"
          value={tokenNumber}
          onChange={(e) => setTokenNumber(e.target.value)}
          className="token-input"
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
