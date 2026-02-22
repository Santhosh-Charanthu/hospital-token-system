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
  console.log("Received background message", payload);

  // Pull from data because we removed the root notification object
  const { title, body, tokenNumber, stage } = payload.data || {};
  const currentStage = Number(stage || 0);

  if (!tokenNumber) return;

  // Your logic to prevent outdated notifications
  if (latestStages[tokenNumber] && latestStages[tokenNumber] >= currentStage) {
    return;
  }
  latestStages[tokenNumber] = currentStage;

  // Manually trigger the notification UI
  return self.registration.showNotification(title || "Hospital Update", {
    body: body || "Your token status has changed.",
    icon: "/notification-icon.png",
    tag: `token-${tokenNumber}`, // This replaces the old notification of the same token
    renotify: true,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: { tokenNumber },
  });
});
