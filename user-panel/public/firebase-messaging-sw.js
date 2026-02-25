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

const messaging = firebase.messaging();

/* 🔥 CRITICAL PART — ANDROID NEEDS THIS */
// self.addEventListener("push", function (event) {
//   if (!event.data) return;

//   const payload = event.data.json();

//   const notification = payload.notification || payload.data;

//   const title = notification.title || "Hospital Token Update";
//   const body = notification.body || "Your token is near.";

//   event.waitUntil(
//     self.registration.showNotification(title, {
//       body: body,
//       icon: "/notification-icon.png",
//       badge: "/notification-icon.png",
//       vibrate: [300, 150, 300],
//       requireInteraction: true,
//       data: {
//         url: payload?.data?.url || "/",
//       },
//     }),
//   );
// });

// self.addEventListener("push", async function (event) {
//   if (!event.data) return;

//   const payload = event.data.json();
//   const pushData = payload.data || {};

//   const clientList = await clients.matchAll({
//     type: "window",
//     includeUncontrolled: true,
//   });

//   let isAppVisible = false;

//   for (const client of clientList) {
//     // visible AND focused tab means user is looking at the app
//     if (client.visibilityState === "visible" && client.focused) {
//       isAppVisible = true;
//       break;
//     }
//   }

//   // Only skip when user is actively watching the page
//   if (isAppVisible) {
//     console.log("User is viewing app → skip SW notification");
//     return;
//   }

//   const title = pushData.title || "Hospital Token Update";
//   const body = pushData.body || "Token update available";

//   self.registration.showNotification(title, {
//     body,
//     icon: "/notification-icon.png",
//     badge: "/notification-icon.png",
//     vibrate: [500, 200, 500, 200, 800],
//     requireInteraction: true,
//     tag: `${pushData.tokenNumber}-${pushData.stage}`,
//     renotify: true,
//     data: { url: pushData.url || "/" },
//   });
// });

self.addEventListener("push", async (event) => {
  if (!event.data) return;

  let payload;

  try {
    payload = event.data.json();
  } catch (err) {
    console.log("Push JSON parse failed");
    return;
  }

  // 🔥 VERY IMPORTANT LINE
  const data = payload.data || {};

  const title = data.title || "Hospital Token Update";
  const body = data.body || "Token update available";

  const notificationId = `${data.tokenNumber}-${data.stage}`;

  // check if page visible
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

  // 🔔 REAL notification
  await self.registration.showNotification(title, {
    body: body,
    icon: "/notification-icon.png",
    badge: "/notification-icon.png",
    vibrate: [500, 200, 500, 200, 800],
    requireInteraction: true,
    renotify: true,
    tag: notificationId,
    data: {
      url: data.url || "/",
    },
  });
});

/* click behaviour */
// self.addEventListener("notificationclick", function (event) {
//   event.notification.close();

//   event.waitUntil(
//     clients
//       .matchAll({ type: "window", includeUncontrolled: true })
//       .then(function (clientList) {
//         for (const client of clientList) {
//           if (client.url.includes("/") && "focus" in client) {
//             return client.focus();
//           }
//         }
//         return clients.openWindow(event.notification.data.url);
//       }),
//   );
// });

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          if (client.url.includes("/") && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow("/");
      }),
  );
});
