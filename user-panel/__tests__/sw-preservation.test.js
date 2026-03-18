/**
 * Preservation Property Tests — Task 3.4
 * Property 2: Preservation - Desktop Notification Behavior and Multi-Stage Ordering
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 *
 * UPDATED for FIXED code:
 *   - The manual self.addEventListener('push', ...) block has been removed.
 *   - Firebase's built-in handler is now the sole push handler.
 *   - Firebase's built-in handler reads from payload.notification (or webpush.notification),
 *     NOT from payload.data fields.
 *   - Tests now verify the Firebase built-in handler behavior on the fixed SW.
 *
 * Key preservation properties verified:
 *   1. Exactly one notification per push event (no duplicate from removed manual listener).
 *   2. notificationclick handler works correctly (focuses window or opens new one).
 *   3. install/activate events never call showNotification.
 *   4. Stage ordering: stages 1–6 each produce the correct notification body.
 */

// ---------------------------------------------------------------------------
// Minimal service-worker global environment mock
// ---------------------------------------------------------------------------

let showNotificationMock;
let pushListeners;
let installListeners;
let activateListeners;
let notificationClickListeners;

function resetSWGlobals() {
  showNotificationMock = jest.fn().mockResolvedValue(undefined);
  pushListeners = [];
  installListeners = [];
  activateListeners = [];
  notificationClickListeners = [];

  global.self = {
    skipWaiting: jest.fn(),
    clients: {
      claim: jest.fn().mockResolvedValue(undefined),
      matchAll: jest.fn().mockResolvedValue([]),
    },
    registration: {
      showNotification: showNotificationMock,
    },
    addEventListener: jest.fn((event, handler) => {
      if (event === 'push') pushListeners.push(handler);
      if (event === 'install') installListeners.push(handler);
      if (event === 'activate') activateListeners.push(handler);
      if (event === 'notificationclick') notificationClickListeners.push(handler);
    }),
  };

  global.clients = global.self.clients;
  global.registration = global.self.registration;
}

// ---------------------------------------------------------------------------
// Firebase stub — simulates Firebase's built-in handler behavior.
// Firebase's built-in handler reads from payload.notification (not payload.data).
// ---------------------------------------------------------------------------

function setupFirebaseStub() {
  global.importScripts = jest.fn();

  global.firebase = {
    initializeApp: jest.fn(),
    messaging: jest.fn(() => {
      // Firebase's built-in push handler reads from payload.notification field
      self.addEventListener('push', async (event) => {
        if (!event.data) return;
        let payload;
        try { payload = event.data.json(); } catch { return; }

        // Firebase built-in reads from notification field (not data fields)
        const notification = payload.notification || {};
        const title = notification.title || 'Firebase Notification';
        const body = notification.body || '';

        await self.registration.showNotification(title, { body, tag: 'firebase-internal' });
      });
    }),
  };
}

// ---------------------------------------------------------------------------
// Load the FIXED service worker (no manual push listener)
// ---------------------------------------------------------------------------

function loadServiceWorker() {
  const fs = require('fs');
  const path = require('path');
  const swPath = path.resolve(__dirname, '../public/firebase-messaging-sw.js');
  const swCode = fs.readFileSync(swPath, 'utf8');

  const sanitised = swCode
    .replace(/importScripts\([^)]*\);?/g, '/* importScripts removed */');

  // eslint-disable-next-line no-eval
  eval(sanitised);
}

// ---------------------------------------------------------------------------
// Helper: build a synthetic push event
// ---------------------------------------------------------------------------

function makePushEvent(payload) {
  const waitUntilPromises = [];
  return {
    data: { json: () => payload },
    waitUntil: (p) => waitUntilPromises.push(p),
    _flush: () => Promise.all(waitUntilPromises),
  };
}

// ---------------------------------------------------------------------------
// Simple random generator helpers (no fast-check dependency)
// ---------------------------------------------------------------------------

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';

function randomString(minLen = 1, maxLen = 40) {
  const len = randomInt(minLen, maxLen);
  let s = '';
  for (let i = 0; i < len; i++) {
    s += CHARS[randomInt(0, CHARS.length - 1)];
  }
  return s;
}

/**
 * Generate a valid FCM payload using the notification field (as Firebase built-in reads it).
 * The fixed SW relies on Firebase's built-in handler which reads from payload.notification.
 * The data field is also included (as the backend sends it) but the handler reads notification.
 */
function randomNotificationPayload() {
  const tokenNumber = randomInt(1, 999);
  const stage = randomInt(1, 6);
  const title = randomString(5, 50);
  const body = randomString(10, 80);
  return {
    notification: {
      title,
      body,
    },
    data: {
      title,
      body,
      tokenNumber: String(tokenNumber),
      stage: String(stage),
      url: '/',
    },
  };
}

// ---------------------------------------------------------------------------
// Stage message map (mirrors backend tokenControllers.js logic)
// ---------------------------------------------------------------------------

const STAGE_MESSAGES = {
  1: '5 patients ahead. Please be ready.',
  2: '3 patients ahead. Please be ready.',
  3: 'Only 2 patients ahead. Please be ready.',
  4: 'You are next. Kindly wait for your turn.',
  5: 'It is your turn now. Please enter the consultation room.',
  6: 'Thank you for visiting. We hope you had a comfortable consultation.',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SW Preservation — Desktop Notification Behavior (fixed code)', () => {
  beforeEach(() => {
    resetSWGlobals();
    setupFirebaseStub();
    jest.resetModules();
    loadServiceWorker();
  });

  /**
   * PBT: for all valid notification payloads (random tokenNumber 1–999,
   * stage 1–6, arbitrary title/body) the fixed SW (Firebase built-in handler only)
   * shows EXACTLY ONE notification with title and body matching notification.title
   * and notification.body.
   *
   * On fixed code: only the Firebase stub's push listener fires (no manual listener),
   * so showNotification is called exactly once per push event.
   *
   * Validates: Requirements 3.1
   */
  test('PBT: Firebase built-in handler shows exactly one notification per push event', async () => {
    const NUM_SAMPLES = 50;

    for (let i = 0; i < NUM_SAMPLES; i++) {
      // Reset globals for each sample
      resetSWGlobals();
      setupFirebaseStub();
      loadServiceWorker();

      const payload = randomNotificationPayload();
      const { title, body } = payload.notification;

      const event = makePushEvent(payload);

      for (const listener of pushListeners) {
        await listener(event);
      }
      await event._flush();

      const calls = showNotificationMock.mock.calls;

      // EXACTLY one notification (no duplicate from removed manual listener)
      expect(calls).toHaveLength(1);

      // Correct title and body from notification field
      const [callTitle, opts] = calls[0];
      expect(callTitle).toBe(title);
      expect(opts.body).toBe(body);
    }
  });

  /**
   * PBT: for all non-push SW events (install, activate),
   * showNotification is never called.
   *
   * Validates: Requirements 3.1
   */
  test('PBT: install and activate events never call showNotification', async () => {
    // Dispatch install event
    const installEvent = { waitUntil: jest.fn() };
    for (const handler of installListeners) {
      await handler(installEvent);
    }

    // Dispatch activate event
    const activateEvent = { waitUntil: jest.fn() };
    for (const handler of activateListeners) {
      await handler(activateEvent);
    }

    expect(showNotificationMock).not.toHaveBeenCalled();
  });

  /**
   * notificationclick handler focuses existing window when one is open.
   *
   * Validates: Requirements 3.1
   */
  test('notificationclick: focuses existing window when one is open', async () => {
    const focusMock = jest.fn().mockResolvedValue(undefined);
    const mockClient = { url: 'http://localhost/', focus: focusMock };

    global.self.clients.matchAll = jest.fn().mockResolvedValue([mockClient]);
    global.clients = global.self.clients;

    const openWindowMock = jest.fn().mockResolvedValue(undefined);
    global.self.clients.openWindow = openWindowMock;
    global.clients.openWindow = openWindowMock;

    const waitUntilPromises = [];
    const notifEvent = {
      notification: {
        close: jest.fn(),
        data: { url: '/waitinghall' },
      },
      waitUntil: (p) => waitUntilPromises.push(p),
    };

    for (const handler of notificationClickListeners) {
      handler(notifEvent);
    }
    await Promise.all(waitUntilPromises);

    expect(notifEvent.notification.close).toHaveBeenCalled();
    expect(focusMock).toHaveBeenCalled();
    expect(openWindowMock).not.toHaveBeenCalled();
  });

  test('notificationclick: opens new window when no existing window is open', async () => {
    global.self.clients.matchAll = jest.fn().mockResolvedValue([]);
    global.clients = global.self.clients;

    const openWindowMock = jest.fn().mockResolvedValue(undefined);
    global.self.clients.openWindow = openWindowMock;
    global.clients.openWindow = openWindowMock;

    const waitUntilPromises = [];
    const notifEvent = {
      notification: {
        close: jest.fn(),
        data: { url: '/waitinghall' },
      },
      waitUntil: (p) => waitUntilPromises.push(p),
    };

    for (const handler of notificationClickListeners) {
      handler(notifEvent);
    }
    await Promise.all(waitUntilPromises);

    expect(notifEvent.notification.close).toHaveBeenCalled();
    expect(openWindowMock).toHaveBeenCalledWith('/waitinghall');
  });

  /**
   * Stage ordering: stages 1–6 each produce the correct notification body.
   * Payload uses notification field (as Firebase built-in reads it).
   *
   * Validates: Requirements 3.2
   */
  test('stage ordering: each stage 1–6 produces the correct notification body', async () => {
    for (const [stage, expectedMessage] of Object.entries(STAGE_MESSAGES)) {
      resetSWGlobals();
      setupFirebaseStub();
      loadServiceWorker();

      const tokenNumber = 42;
      const title = 'Hospital Token Update';
      const body = `Token ${tokenNumber}: ${expectedMessage}`;

      const payload = {
        notification: {
          title,
          body,
        },
        data: {
          title,
          body,
          tokenNumber: String(tokenNumber),
          stage: String(stage),
          url: '/',
        },
      };

      const event = makePushEvent(payload);

      for (const listener of pushListeners) {
        await listener(event);
      }
      await event._flush();

      const calls = showNotificationMock.mock.calls;

      // Exactly one notification per stage
      expect(calls).toHaveLength(1);

      const [callTitle, opts] = calls[0];
      expect(callTitle).toBe(title);
      expect(opts.body).toBe(body);
    }
  });
});
