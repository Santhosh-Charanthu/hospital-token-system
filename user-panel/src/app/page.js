"use client";

import { useEffect, useState } from "react";
import io from "socket.io-client";
import { onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "./firebase";
import { motion, AnimatePresence } from "framer-motion";
import TokenAlertModal from "../components/TokenAlertModal";
import { Bell } from "lucide-react";
import "../../styles/UserPanel.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

function showForegroundNotification(payload) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const notificationPayload = payload?.notification || {};
  const dataPayload = payload?.data || {};

  const title =
    dataPayload.title || notificationPayload.title || "Hospital Token Update";
  const body =
    dataPayload.body || notificationPayload.body || "Token update available";
  const icon =
    dataPayload.icon || notificationPayload.icon || "/notification-icon.png";

  new Notification(title, {
    body,
    icon,
    badge: icon,
  });
}

export default function UserPanel() {
  const [socket, setSocket] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [serverError, setServerError] = useState(false);
  const [activeToken, setActiveToken] = useState(null);
  const [upcomingTokens, setUpcomingTokens] = useState([]);

  const fetchInitialData = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${BASE_URL}/api/tokens/current`, {
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("Server error");

      const data = await res.json();
      setActiveToken(data.activeToken);
      setUpcomingTokens(data.upcomingTokens);
      setServerError(false);
    } catch (err) {
      console.error("Backend connection failed", err);
      setServerError(true);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  useEffect(() => {
    const s = io(BASE_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      transports: ["websocket"],
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      fetchInitialData(); // try again automatically
    };

    const handleOffline = () => {
      setIsOnline(false);
      setServerError(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Initial fetch when socket becomes ready
    fetchInitialData();

    socket.on("connect", () => {
      console.log("✅ Socket connected");
      setServerError(false);
      fetchInitialData(); // 🔥 re-sync when server comes back
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      setServerError(true);
    });

    socket.on("TOKEN_UPDATE", (data) => {
      setActiveToken(data.activeToken);
      setUpcomingTokens(data.upcomingTokens);
    });

    socket.on("TOKEN_CREATED", (data) => {
      window.dispatchEvent(
        new CustomEvent("last-token-updated", {
          detail: data.tokenNumber,
        }),
      );
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("TOKEN_UPDATE");
    };
  }, [socket]);

  useEffect(() => {
    let unsubscribe;

    const setupForegroundListener = async () => {
      try {
        const messaging = await getFirebaseMessaging();
        if (!messaging) return;

        unsubscribe = onMessage(messaging, (payload) => {
          console.log("Foreground FCM:", payload);
          showForegroundNotification(payload);
        });
      } catch (err) {
        console.log("Foreground messaging unavailable:", err.message);
      }
    };

    setupForegroundListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <div className="screen">
      {/* 🧭 NAVBAR */}
      <header className="navbar">
        <div className="navbar-left">
          <img
            src="/Hospital-logo.jpg"
            alt="Hope Homoeopathy Logo"
            className="navbar-logo"
          />{" "}
          <div className="clinic-text">
            <h1>HOPE HOMOEOPATHY, Malakpet</h1>
            <p>OPD Timings: 10:00 AM – 5:00 PM</p>
          </div>
        </div>

        <div className="navbar-right">
          <span className="live-dot" />
          <span>Live Token Status</span>
        </div>
      </header>
      <TokenAlertModal
        open={showModal}
        onClose={() => setShowModal(false)}
        activeToken={activeToken}
        upcomingTokens={upcomingTokens}
      />

      {(!isOnline || serverError) && (
        <div className="error-banner">
          {!isOnline
            ? "No Internet Connection"
            : "Unable to connect to server. Please wait..."}
        </div>
      )}

      {/* 📺 MAIN CONTENT */}
      {/* <main className="container">
        <h1 className="title">Now Serving</h1>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeToken?.tokenNumber || "none"}
            className="current-token"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {activeToken ? activeToken.tokenNumber : "--"}
          </motion.div>
        </AnimatePresence>

        <h2 className="subtitle">Next Tokens</h2>

        <div className="upcoming">
          <AnimatePresence>
            {upcomingTokens.length > 0 ? (
              upcomingTokens.map((token) => (
                <motion.span
                  key={token._id}
                  className="token"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  {token.tokenNumber}
                </motion.span>
              ))
            ) : (
              <p>No tokens in queue</p>
            )}
          </AnimatePresence>
        </div>
      </main> */}
      <main className="container">
        <div className="status-text">
          <h1>Now Serving Token</h1>
        </div>

        <div className="token-section">
          {/* SERVING CARD */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeToken?.tokenNumber || "none"}
              className="current-token-card"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="serving-header">
                <span className="line"></span>
                <span>Serving Now</span>
                <span className="line"></span>
              </div>

              <div className="token-number">
                {activeToken ? activeToken.tokenNumber : "--"}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* NEXT TOKENS CARD */}
          <div className="next-card">
            <div className="next-header">
              <span className="line"></span>
              <h2>Up Next</h2>
              <span className="line"></span>
            </div>

            <div className="next-tokens">
              {upcomingTokens.map((token) => (
                <span key={token._id} className="next-token">
                  {token.tokenNumber}
                </span>
              ))}
            </div>

            <p className="wait-time">
              Estimated waiting Time : 10 - 15 Minutes
            </p>
          </div>
        </div>
      </main>
      {/* 🔘 FLOATING ACTION BUTTONS */}
      <div className="fab-container">
        {/* 🔔 Show bell ONLY when NOT fullscreen */}
        {!isFullscreen && (
          <button
            className="fab fab-bell"
            onClick={() => setShowModal(true)}
            aria-label="Enable token alerts"
          >
            <Bell size={26} />
          </button>
        )}
      </div>
    </div>
  );
}
