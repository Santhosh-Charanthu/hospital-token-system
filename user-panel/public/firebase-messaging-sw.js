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

messaging.onBackgroundMessage(async (payload) => {
  const tokenNumber = payload.data?.tokenNumber;
  const stage = Number(payload.data?.stage || 0);

  if (!tokenNumber) return;

  // If we already showed a newer stage → ignore old notification
  if (latestStages[tokenNumber] && latestStages[tokenNumber] >= stage) {
    console.log("Ignored outdated notification");
    return;
  }

  latestStages[tokenNumber] = stage;

  await self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/logo.png",
    tag: `token-${tokenNumber}`,
    renotify: true,
  });
});
