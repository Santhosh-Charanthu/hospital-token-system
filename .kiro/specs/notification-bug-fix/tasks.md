# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Duplicate Notification and Mobile Delivery Failure
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate both bugs before the fix
  - **Scoped PBT Approach**: Scope to concrete failing cases — a push event dispatched to the unfixed service worker (isBugCondition_duplicate: firebase.messaging() AND self.addEventListener('push') both registered), and a backend FCM payload with a top-level `notification` field sent to an Android Chrome subscriber (isBugCondition_mobile)
  - Write a service worker unit test: dispatch a synthetic push event with a valid JSON payload to the unfixed `firebase-messaging-sw.js` and assert `self.registration.showNotification` is called exactly once
  - Run test on UNFIXED code — **EXPECTED OUTCOME**: Test FAILS (showNotification called twice, confirming duplicate bug)
  - Write a backend payload inspection test: assert that `admin.messaging().send()` in `completeToken` is called with a payload that has NO top-level `notification` field — run on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (top-level `notification` field is present, confirming mobile delivery bug)
  - Document counterexamples found (e.g., "showNotification called 2 times for one push event", "payload.notification exists when it should not")
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Desktop Notification Behavior and Multi-Stage Ordering
  - **IMPORTANT**: Follow observation-first methodology — observe behavior on UNFIXED code for non-buggy inputs first
  - Observe: on desktop Chrome, a push event with valid `data` fields (tokenNumber, stage, title, body) produces a notification with the correct title, body, icon, badge, tag, and requireInteraction values
  - Observe: stages 1–6 fire in order, each producing exactly one notification with the correct message text per stage
  - Observe: re-subscribing with the same device token results in only one `TokenAlert` record in the DB
  - Observe: `notificationclick` handler focuses an existing window or opens a new one at `data.url`
  - Write property-based test: for all valid `data` payloads (random tokenNumber 1–999, stage 1–6, arbitrary title/body strings) where neither bug condition holds, assert the service worker shows exactly one notification with title and body matching `data.title` and `data.body`
  - Write property-based test: for all non-push SW events (install, activate), assert `showNotification` is never called
  - Verify all preservation tests PASS on UNFIXED code before implementing the fix
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix duplicate notifications and mobile delivery failure

  - [x] 3.1 Remove manual push listener from service worker
    - Open `user-panel/public/firebase-messaging-sw.js`
    - Delete the entire `self.addEventListener('push', ...)` block (the handler that calls `self.registration.showNotification` manually)
    - Keep `firebase.messaging()` as the sole push event handler
    - Keep the `notificationclick` listener unchanged
    - Keep `install` and `activate` listeners unchanged
    - _Bug_Condition: isBugCondition_duplicate(swContext) — firebase.messaging() AND self.addEventListener('push') both registered in the same SW context_
    - _Expected_Behavior: exactly one showNotification call per push event, content derived from webpush.notification fields_
    - _Preservation: notificationclick handler, install/activate lifecycle, desktop notification display_
    - _Requirements: 2.1, 3.1, 3.2_

  - [x] 3.2 Remove top-level notification field from FCM payload
    - Open `backend/controllers/tokenControllers.js`, function `completeToken`
    - Remove the top-level `notification: { title, body }` field from the `admin.messaging().send()` call
    - Ensure `webpush.notification` block (title, body, icon, badge, tag, requireInteraction) remains intact as the sole notification display source
    - Ensure the `data` field (title, body, tokenNumber, stage, url) remains intact
    - Keep `webpush.headers` (Urgency, TTL) and `webpush.fcmOptions.link` unchanged
    - _Bug_Condition: isBugCondition_mobile(fcmPayload, platform) — fcmPayload.notification present AND platform is Android Chrome or iOS PWA_
    - _Expected_Behavior: data-only FCM message so push event is always delivered to the service worker on all platforms_
    - _Preservation: webpush.notification options, data fields, stage logic, multi-stage ordering_
    - _Requirements: 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Exactly One Notification Per Push Event
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - Run the service worker unit test: assert showNotification is called exactly once per push event on the FIXED service worker
    - Run the backend payload test: assert the FCM payload sent by `completeToken` has no top-level `notification` field
    - **EXPECTED OUTCOME**: Both tests PASS (confirms both bugs are fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Desktop and Multi-Stage Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run all property-based preservation tests from step 2 against the FIXED code
    - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions in desktop notifications, stage ordering, re-subscription, or token reset)
    - Confirm notificationclick handler still works correctly

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite (exploration test + preservation tests)
  - Confirm Property 1 (bug condition) passes on fixed code
  - Confirm Property 2 (preservation) passes on fixed code
  - Ensure all tests pass; ask the user if any questions arise
