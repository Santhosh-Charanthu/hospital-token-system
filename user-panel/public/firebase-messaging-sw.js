importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyCiboh5YtIxPy-YqzJkafV2mFCqNoFjaR0",
  authDomain: "hospital-token-system-cccb1.firebaseapp.com",
  projectId: "hospital-token-system-cccb1",
  storageBucket: "hospital-token-system-cccb1.firebasestorage.app",
  messagingSenderId: "20421799593",
  appId: "1:20421799593:web:4738f29f1003f7c861c3b8",
  measurementId: "G-MNZ76R5HGR",
});

firebase.messaging();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", async (event) => {
  if (!event.data) return;

  let payload;

  try {
    payload = event.data.json();
  } catch (err) {
    console.log("Push JSON parse failed");
    return;
  }

  const data = payload.data || {};
  const notificationPayload = payload.notification || {};

  const title = data.title || notificationPayload.title || "Hospital Token Update";
  const body = data.body || notificationPayload.body || "Token update available";
  const tokenNumber = data.tokenNumber || "unknown";
  const stage = data.stage || "0";
  const notificationId = `${tokenNumber}-${stage}`;

  const clientsList = await clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  let isVisible = false;

  for (const client of clientsList) {
    if (client.visibilityState === "visible" && client.focused) {
      isVisible = true;
      client.postMessage({
        type: "PUSH_HANDLED",
        id: notificationId,
      });
    }
  }

  if (isVisible) return;

  await self.registration.showNotification(title, {
    body,
    icon: data.icon || notificationPayload.icon || "/notification-icon.png",
    badge: data.badge || notificationPayload.badge || "/notification-icon.png",
    vibrate: [500, 200, 500, 200, 800],
    requireInteraction: true,
    renotify: true,
    tag: notificationId,
    data: {
      url: data.url || "/",
    },
  });
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          if (client.url.includes("/") && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(targetUrl);
      }),
  );
});
