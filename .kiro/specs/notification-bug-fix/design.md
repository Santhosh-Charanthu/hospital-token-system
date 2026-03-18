# Notification Bug Fix Design

## Overview

Two bugs affect the token alert push notification system:

1. **Duplicate Notifications**: `firebase.messaging()` in the service worker registers Firebase's built-in `push` event handler, which automatically shows a notification. A manual `push` event listener in the same service worker also fires and shows a second notification. Both handlers run for every incoming push event, resulting in two identical notifications per stage event.

2. **Mobile Notifications Not Working**: The FCM payload sent from the backend includes both a `notification` field and a `webpush.notification` field alongside a `data` field. On Android Chrome and iOS PWA, when a `notification` field is present at the top level of the FCM message, the Firebase SDK intercepts the push event before the service worker's manual `push` listener can run, and the `webpush` options may not be applied correctly. The fix requires sending a data-only message (no top-level `notification` key) so the service worker has full control over notification display on all platforms.

The fix strategy is:
- Remove the manual `push` event listener from the service worker and rely solely on Firebase's built-in handler (or vice versa — remove `firebase.messaging()` and keep only the manual listener with a corrected payload).
- Change the backend FCM payload to data-only (remove the top-level `notification` field) so the service worker's `push` handler fires reliably on mobile and constructs the notification from `data` fields.

---

## Glossary

- **Bug_Condition (C)**: The set of conditions that trigger either bug — a push event arriving while both the Firebase built-in handler and the manual `push` listener are active (duplicate), or a push event arriving on a mobile browser when the payload contains a top-level `notification` field (mobile delivery failure).
- **Property (P)**: The desired correct behavior — exactly one notification is shown per push event on all platforms (desktop and mobile).
- **Preservation**: Existing behaviors that must remain unchanged — desktop notifications, multi-stage ordering, re-subscription replacement, and token reset clearing all subscriptions.
- **firebase.messaging()**: Called in `firebase-messaging-sw.js`; registers Firebase's internal `push` and `notificationclick` handlers automatically.
- **manual push listener**: The `self.addEventListener('push', ...)` block in `firebase-messaging-sw.js` that also shows a notification.
- **data-only FCM message**: An FCM message with no top-level `notification` field; the push event is always delivered to the service worker on all platforms, giving the SW full control.
- **webpush.notification**: The FCM-specific notification options block used when sending via the Admin SDK's `webpush` property.
- **stage**: A numeric progress marker (1–6) tracking how far ahead the active token is from a subscribed patient's token.

---

## Bug Details

### Bug Condition

**Bug 1 — Duplicate Notifications:**

The duplicate fires because `firebase.messaging()` in the service worker installs Firebase's own `push` event listener internally, and the explicit `self.addEventListener('push', ...)` block is a second independent listener. The Web Push spec delivers the event to all registered listeners, so both run.

```
FUNCTION isBugCondition_duplicate(swContext)
  INPUT: swContext — the service worker execution context
  OUTPUT: boolean

  RETURN firebase.messaging() IS called in swContext
         AND self.addEventListener('push', ...) IS also registered in swContext
END FUNCTION
```

**Bug 2 — Mobile Delivery Failure:**

```
FUNCTION isBugCondition_mobile(fcmPayload, clientPlatform)
  INPUT: fcmPayload — the message object sent via admin.messaging().send()
         clientPlatform — the receiving browser/OS
  OUTPUT: boolean

  RETURN fcmPayload.notification IS present (top-level)
         AND clientPlatform IN ['Android Chrome', 'iOS PWA']
END FUNCTION
```

### Examples

- **Duplicate (desktop)**: User on desktop Chrome receives a stage-1 alert. Two identical "5 patients ahead" notifications appear simultaneously.
- **Duplicate (background tab)**: App is in background. Two banners appear for the same event.
- **Mobile delivery failure (Android Chrome)**: User subscribes on Android Chrome. Stage-1 threshold is crossed. No notification appears on the device.
- **Mobile delivery failure (iOS PWA)**: User installs the app to Home Screen on iPhone. Stage-4 alert fires. No notification is received.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Desktop browser (Chrome, Firefox, Edge) notifications must continue to display correctly after the fix.
- Multi-stage notifications (stages 1–6) must continue to fire in the correct order, one per stage.
- Re-subscribing (calling `/api/tokens/token-alert` again) must continue to replace the old subscription so only one alert record exists per device.
- Resetting the token system must continue to delete all `TokenAlert` records so no stale notifications are sent.
- The `notificationclick` handler must continue to focus or open the app window when a notification is tapped.

**Scope:**
All behaviors that do NOT involve the push event handler conflict or the FCM payload structure must be completely unaffected. This includes:
- Socket-based real-time token updates (`TOKEN_UPDATE`, `TOKEN_CREATED` events)
- Token generation and completion flows
- The `TokenRoller` UI and subscription modal
- Service worker registration and update logic in `FCMInit.jsx` and `TokenAlertModal.jsx`

---

## Hypothesized Root Cause

### Bug 1 — Duplicate Notifications

1. **Double listener registration**: `firebase.messaging()` (compat SDK) internally calls `self.addEventListener('push', ...)` to intercept push events and show notifications. The explicit `self.addEventListener('push', ...)` block below it is a second independent listener. Both fire for every push event.

2. **No deduplication guard**: There is no tag-based deduplication or flag that prevents the second `showNotification` call from overwriting or suppressing the first. Both calls use the same `tag` value (`notificationId`), but because they execute nearly simultaneously, the browser may render both before the second replaces the first, or the Firebase internal handler may bypass the tag.

### Bug 2 — Mobile Delivery Failure

1. **Top-level `notification` field causes FCM to handle delivery natively on mobile**: When a message contains a top-level `notification` field, FCM's mobile SDKs (and the browser's push infrastructure on Android) handle display natively without invoking the service worker's `push` event. This means the SW's custom `push` listener never fires, and the `webpush.notification` options (icon, badge, tag, requireInteraction) may not be applied.

2. **iOS PWA push delivery requires data-only messages**: iOS 16.4+ PWA push support requires the push event to reach the service worker. A top-level `notification` field can cause the event to be swallowed by the system before the SW processes it.

3. **`webpush.notification` vs top-level `notification` conflict**: Having both fields in the same FCM payload creates ambiguity. The `webpush.notification` block is the correct place for web-specific notification options, but the top-level `notification` field takes precedence on mobile platforms.

---

## Correctness Properties

Property 1: Bug Condition - Exactly One Notification Per Push Event

_For any_ push event delivered to the service worker where a valid FCM payload is received (isBugCondition_duplicate returns true OR isBugCondition_mobile returns true), the fixed service worker and backend SHALL result in exactly one notification being displayed on the device, with the correct title, body, icon, badge, and tag derived from the payload's `data` fields.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Existing Notification Behavior Unchanged

_For any_ push event delivered to a desktop browser where neither bug condition holds (isBugCondition_duplicate returns false AND isBugCondition_mobile returns false after the fix), the fixed service worker SHALL produce exactly the same visible notification as the original service worker produced before the duplicate bug was introduced, preserving title, body, icon, badge, tag, requireInteraction, and click behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**Fix 1 — Remove the manual `push` listener, rely on Firebase's built-in handler**

**File**: `user-panel/public/firebase-messaging-sw.js`

**Specific Changes**:
1. **Remove the entire `self.addEventListener('push', ...)` block**: Firebase's built-in handler (registered by `firebase.messaging()`) will handle all background push events. It reads `notification` fields from the payload automatically.
2. **Keep `firebase.messaging()`**: This is the single handler going forward.
3. **Keep `notificationclick` listener**: Firebase's built-in handler does not replace the custom click handler; keep it as-is.
4. **Keep `install` and `activate` listeners**: No change needed.

However, this alone does not fix Bug 2. Firebase's built-in handler on mobile still depends on the payload structure.

**Fix 2 — Send data-only FCM messages from the backend**

**File**: `backend/controllers/tokenControllers.js`

**Function**: `completeToken`

**Specific Changes**:
1. **Remove the top-level `notification` field** from the `admin.messaging().send()` call. This forces FCM to treat the message as data-only, ensuring the push event is always delivered to the service worker on all platforms including Android Chrome and iOS PWA.
2. **Move all notification content into `webpush.notification`**: Title, body, icon, badge, tag, and requireInteraction are already present in `webpush.notification` — this block becomes the sole source of notification display options for web clients.
3. **Keep the `data` field intact**: The service worker reads `data.title`, `data.body`, `data.tokenNumber`, `data.stage`, and `data.url` — these must remain.
4. **Keep `webpush.headers`** (Urgency, TTL) and `webpush.fcmOptions.link` unchanged.

**Combined effect**: With no top-level `notification` field, FCM delivers the raw push event to the service worker on all platforms. With the manual `push` listener removed, only Firebase's built-in handler fires, reading from `webpush.notification` to display exactly one notification.

**Alternative approach** (if Firebase built-in handler proves insufficient for custom options):
- Keep the manual `push` listener and remove `firebase.messaging()` instead.
- The manual listener already reads from `data` fields and calls `self.registration.showNotification(...)` with full custom options.
- This gives maximum control but requires ensuring the data-only payload fix (Fix 2) is also applied.

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate both bugs BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write service worker unit tests that simulate push events and assert on `showNotification` call counts and arguments. Run on the UNFIXED service worker to observe duplicate calls.

**Test Cases**:
1. **Duplicate notification test**: Dispatch a synthetic `push` event with a valid JSON payload to the unfixed service worker. Assert that `self.registration.showNotification` is called exactly once. (Will fail — called twice on unfixed code.)
2. **Data-only payload test**: Dispatch a push event whose payload has no `notification` field, only `data` fields. Assert the notification title and body are read from `data`. (Should pass — manual listener already reads `data`.)
3. **Mobile payload structure test**: Send a test FCM message from the backend with the current payload (top-level `notification` present) to an Android Chrome subscriber. Observe whether the push event reaches the service worker. (Will fail on mobile — SW push listener does not fire.)
4. **Notification count on background tab**: Open the app in a background tab, trigger a stage event, and count visible notifications in the browser. (Will show 2 on unfixed code.)

**Expected Counterexamples**:
- `showNotification` is called twice per push event on the unfixed service worker.
- On Android Chrome, the push event does not reach the service worker when the payload has a top-level `notification` field.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces exactly one notification with correct content.

**Pseudocode:**
```
FOR ALL pushEvent WHERE isBugCondition_duplicate(swContext) OR isBugCondition_mobile(fcmPayload, platform) DO
  result := dispatchPushEvent_fixed(pushEvent)
  ASSERT showNotificationCallCount(result) == 1
  ASSERT notificationTitle(result) == expectedTitle
  ASSERT notificationBody(result) == expectedBody
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where neither bug condition holds, the fixed service worker produces the same notification as the original.

**Pseudocode:**
```
FOR ALL pushEvent WHERE NOT isBugCondition_duplicate(swContext) AND NOT isBugCondition_mobile(fcmPayload, platform) DO
  ASSERT showNotification_original(pushEvent) == showNotification_fixed(pushEvent)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random payload combinations automatically
- It catches edge cases like missing fields, empty strings, or unusual stage values
- It provides strong guarantees that notification content is unchanged for all valid non-buggy inputs

**Test Plan**: Observe notification behavior on desktop with the unfixed code first, capture the exact title/body/icon/tag values, then write property-based tests asserting those values are preserved after the fix.

**Test Cases**:
1. **Desktop notification preservation**: Verify that after the fix, a push event on desktop Chrome still produces a notification with the same title, body, icon, badge, tag, and requireInteraction as before.
2. **Stage ordering preservation**: Trigger stages 1 through 6 in sequence and verify each produces exactly one notification with the correct message text.
3. **Notification click preservation**: Simulate a `notificationclick` event and verify the handler focuses an existing window or opens a new one at the correct URL.
4. **Re-subscription preservation**: Subscribe twice with the same device token and verify only one `TokenAlert` record exists and only one notification fires per stage.

### Unit Tests

- Test that `showNotification` is called exactly once per push event after removing the duplicate listener
- Test that notification title and body are correctly read from `data` fields when no top-level `notification` is present
- Test edge cases: missing `data.title`, missing `data.body`, missing `data.tokenNumber`
- Test that the `notificationclick` handler correctly extracts `data.url` and opens/focuses the right window

### Property-Based Tests

- Generate random valid FCM `data` payloads (random tokenNumber 1–999, stage 1–6, arbitrary title/body strings) and verify the service worker always shows exactly one notification with matching title and body
- Generate random non-push events (install, activate, fetch) and verify they do not trigger `showNotification`
- Generate random stage sequences and verify the backend sends the correct message text for each `diff` value

### Integration Tests

- End-to-end: trigger `completeToken` on the backend, verify exactly one push notification is received on a subscribed desktop browser
- End-to-end: trigger `completeToken` on the backend, verify exactly one push notification is received on a subscribed Android Chrome browser (data-only payload)
- End-to-end: verify all 6 stages fire in order for a single subscribed device token
- End-to-end: verify that resetting tokens clears all `TokenAlert` records and no further notifications are sent
