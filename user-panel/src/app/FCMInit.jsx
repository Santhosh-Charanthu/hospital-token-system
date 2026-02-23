"use client";
import { useEffect } from "react";

export default function FCMInit() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .then(() => console.log("SW registered"))
      .catch(console.error);
  }, []);

  return null;
}
