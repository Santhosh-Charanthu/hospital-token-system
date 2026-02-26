"use client";
import { useEffect } from "react";

export default function FCMInit() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/firebase-messaging-sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registration) => {
        registration.update();
        console.log("SW registered", registration.scope);
      })
      .catch(console.error);
  }, []);

  return null;
}
