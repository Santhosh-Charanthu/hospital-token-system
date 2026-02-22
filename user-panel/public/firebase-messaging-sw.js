importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js",
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

const messaging = firebase.messaging();

const latestStages = {}; // memory cache

// messaging.onBackgroundMessage(async (payload) => {
//   const tokenNumber = payload.data?.tokenNumber;
//   const stage = Number(payload.data?.stage || 0);

//   if (!tokenNumber) return;

//   // If we already showed a newer stage → ignore old notification
//   if (latestStages[tokenNumber] && latestStages[tokenNumber] >= stage) {
//     console.log("Ignored outdated notification");
//     return;
//   }

//   latestStages[tokenNumber] = stage;

//   await self.registration.showNotification(payload.notification.title, {
//     body: payload.notification.body,
//     icon: "/notification-icon.png",
//     tag: `token-${tokenNumber}`,
//     renotify: true,
//   });
// });

messaging.onBackgroundMessage(async (payload) => {
  console.log("Background message received:", payload);

  const tokenNumber = payload.data?.tokenNumber;
  const stage = Number(payload.data?.stage || 0);

  if (!tokenNumber) return;

  if (latestStages[tokenNumber] && latestStages[tokenNumber] >= stage) {
    return;
  }

  latestStages[tokenNumber] = stage;

  // 🛡️ DEFENSIVE CHECK: Fallback if payload.notification is missing
  const notificationTitle =
    payload.notification?.title || payload.data?.title || "Hospital Update";
  const notificationBody =
    payload.notification?.body ||
    payload.data?.body ||
    "New token status available.";

  await self.registration.showNotification(notificationTitle, {
    body: notificationBody,
    icon: "/notification-icon.png",
    tag: `token-${tokenNumber}`,
    renotify: true,
    // Add this for mobile vibration/sound
    vibrate: [200, 100, 200],
    data: { tokenNumber },
  });
});
