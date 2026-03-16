"use client";

import { useState, useEffect } from "react";
import { getFirebaseMessaging } from "../app/firebase";
import { getToken } from "firebase/messaging";
import { deleteToken } from "firebase/messaging";
import TokenRoller from "./TokenRoller";
import "../../styles/TokenAlertModal.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const IOS_USER_AGENT_REGEX = /iPad|iPhone|iPod/;

function isIosDevice() {
  if (typeof window === "undefined") return false;

  return IOS_USER_AGENT_REGEX.test(window.navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function getPushSupportError() {
  if (typeof window === "undefined") return "Notifications are unavailable";

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return "Notifications are not supported on this browser";
  }

  if (!("PushManager" in window)) {
    return "This mobile browser does not support push notifications";
  }

  if (!window.isSecureContext) {
    return "Open this site on HTTPS (or localhost) to enable alerts";
  }

  if (isIosDevice() && !isStandaloneMode()) {
    return "On iPhone, install this app to your Home Screen and open it from there to enable alerts";
  }

  return "";
}

function getFriendlyPushError(error) {
  const message = error?.message || "";
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("push service error") ||
    lowerMessage.includes("registration failed")
  ) {
    if (isIosDevice() && !isStandaloneMode()) {
      return "Push alerts work on iPhone only after installing this app to the Home Screen and opening it from there";
    }

    return "Push registration failed on this phone. Try Chrome on Android, or install the app to the Home Screen on iPhone and open it from there";
  }

  if (lowerMessage.includes("fcm not supported")) {
    return "This browser cannot receive Firebase push notifications";
  }

  return message || "Something went wrong";
}

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

      const pushSupportError = getPushSupportError();
      if (pushSupportError) {
        setMessage(pushSupportError);
        setLoading(false);
        return;
      }

      // Ask permission
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage("Notification permission denied");
        setLoading(false);
        return;
      }

      const messaging = await getFirebaseMessaging();

      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        {
          scope: "/",
          updateViaCache: "none",
        },
      );

      await registration.update();
      await navigator.serviceWorker.ready;

      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Service worker did not take control"));
          }, 8000);

          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => {
              clearTimeout(timeout);
              resolve();
            },
            { once: true },
          );
        });
      }

      await deleteToken(messaging);

      const deviceToken = await getToken(messaging, {
        vapidKey:
          "BPax7CFWCKoKcy2t-ywwPge0uNO0V38v6-y0DESVYVrSPrTGYvs_LaKMJBaPsDfBoAIUN-wuuP2ZGtQSIo7uDzc",
        serviceWorkerRegistration: registration,
      });

      if (!deviceToken) {
        setMessage("Unable to get notification token on this mobile browser");
        setLoading(false);
        return;
      }

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
        setMessage(data.message || "Subscription failed");
      }
    } catch (err) {
      console.error(err);
      setMessage(getFriendlyPushError(err));
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
          Enter your token number. We will notify you when 5 patients are ahead
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
