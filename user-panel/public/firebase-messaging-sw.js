// Do NOT call firebase.messaging() — it registers its own push listener
// which only works when a top-level `notification` field is present.
// We use a manual push listener instead so we have full control over
// notification display on all platforms (desktop, Android Chrome, iOS PWA).

self.addEventListener("push", function (event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    return;
  }

  // Read from data fields (data-only FCM message)
  const data = payload.data || {};
  const title = data.title || "Hospital Token Update";
  const body = data.body || "";
  const url = data.url || "/";
  const tokenNumber = data.tokenNumber || "";
  const stage = data.stage || "";
  const tag = tokenNumber && stage ? `${tokenNumber}-${stage}` : "token-alert";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/notification-icon.png",
      badge: "/notification-icon.png",
      tag,
      requireInteraction: true,
      data: { url },
    })
  );
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
