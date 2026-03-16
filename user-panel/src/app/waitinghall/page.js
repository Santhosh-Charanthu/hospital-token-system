"use client";

import { useEffect, useState } from "react";
import io from "socket.io-client";
import { onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "../firebase";
import { motion, AnimatePresence } from "framer-motion";
import TokenAlertModal from "../../components/TokenAlertModal";
import { Bell } from "lucide-react";
import "../../../styles/UserPanel.css";

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

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("TOKEN_UPDATE");
    };
  }, [socket]);

  // useEffect(() => {
  //   if (!navigator.serviceWorker) return;

  //   navigator.serviceWorker.addEventListener("message", (event) => {
  //     if (event.data?.type === "PUSH_HANDLED") {
  //       localStorage.setItem("lastNotification", event.data.id);
  //     }
  //   });
  // }, []);

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

  // async function requestPerimission() {
  //   const permission = await Notification.requestPermission();
  //   if (permission === "granted") {
  //     const messaging = await getFirebaseMessaging();
  //     const token = await getToken(messaging, {
  //       vapidKey:
  //         "BPax7CFWCKoKcy2t-ywwPge0uNO0V38v6-y0DESVYVrSPrTGYvs_LaKMJBaPsDfBoAIUN-wuuP2ZGtQSIo7uDzc",
  //     });
  //     console.log("Token Gen", token);
  //   } else if (permission == "denied") {
  //     alert("You denied for the notification");
  //   }
  // }

  // useEffect(() => {
  //   requestPerimission();
  // }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        // Exit fullscreen
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  return (
    <div className="screen waiting-hall-screen" onClick={toggleFullscreen}>
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

      {(!isOnline || serverError) && (
        <div className="error-banner">
          {!isOnline
            ? "No Internet Connection"
            : "Unable to connect to server. Please wait..."}
        </div>
      )}

      {/* 📺 MAIN CONTENT */}
      <main className="container">
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
      </main>
    </div>
  );
}
