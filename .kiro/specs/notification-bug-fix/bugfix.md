# Bugfix Requirements Document

## Introduction

Two bugs affect the token alert notification system. First, when a user enables alerts, they receive each push notification twice — once from the Firebase SDK's built-in message handler (triggered by `firebase.messaging()` in the service worker) and once from the manual `push` event listener in the same service worker. Second, push notifications are not being received on mobile devices (Android Chrome and iOS PWA), likely because the FCM payload structure sent from the backend does not satisfy the requirements of mobile push delivery.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a token alert stage is triggered and the app is in the foreground or background, THEN the system displays two identical push notifications for the same token update event.

1.2 WHEN a user subscribes to token alerts on a mobile device (Android Chrome or iOS PWA) and a token stage is reached, THEN the system does not deliver a push notification to the mobile device.

### Expected Behavior (Correct)

2.1 WHEN a token alert stage is triggered, THEN the system SHALL display exactly one push notification per stage event, regardless of whether the app is in the foreground or background.

2.2 WHEN a user subscribes to token alerts on a mobile device and a token stage is reached, THEN the system SHALL deliver the push notification to the mobile device.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a token alert stage is triggered and the app is open in a desktop browser, THEN the system SHALL CONTINUE TO display the push notification correctly.

3.2 WHEN a user subscribes to token alerts and multiple stage thresholds are crossed (e.g., 5 ahead, 3 ahead, next), THEN the system SHALL CONTINUE TO send one notification per stage in the correct order.

3.3 WHEN a user re-subscribes to alerts (enabling alerts again after a previous subscription), THEN the system SHALL CONTINUE TO replace the old subscription and notify only once per stage.

3.4 WHEN the token system is reset, THEN the system SHALL CONTINUE TO clear all alert subscriptions so no stale notifications are sent.
