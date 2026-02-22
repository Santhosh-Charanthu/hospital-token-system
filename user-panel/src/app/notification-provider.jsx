"use client";

import { useEffect } from "react";

export default function NotificationProvider() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then((reg) => console.log("SW registered", reg))
        .catch((err) => console.log("SW failed", err));
    }
  }, []);

  return null;
}
