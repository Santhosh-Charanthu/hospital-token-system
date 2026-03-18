/**
 * Bug Condition Exploration Test — Task 1, Sub-task 1
 * Property 1: Bug Condition - Duplicate Notification
 *
 * Validates: Requirements 1.1
 *
 * CRITICAL: This test MUST FAIL on unfixed code.
 * Failure confirms the duplicate notification bug exists.
 * DO NOT fix the test or the code when it fails.
 *
 * Expected counterexample: showNotification called 2 times for one push event.
 */

// ---------------------------------------------------------------------------
// Minimal service-worker global environment mock
// ---------------------------------------------------------------------------

let showNotificationMock;
let pushListeners;
let installListeners;
let activateListeners;

function resetSWGlobals() {
  showNotificationMock = jest.fn().mockResolvedValue(undefined);
  pushListeners = [];
  installListeners = [];
  activateListeners = [];

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
    }),
  };

  // Make self properties available at global scope (as in a real SW)
  global.clients = global.self.clients;
  global.registration = global.self.registration;
}

// ---------------------------------------------------------------------------
// Minimal firebase compat SDK stub
// The real SDK registers its OWN internal push listener when
// firebase.messaging() is called — we replicate that behaviour here.
// ---------------------------------------------------------------------------

function setupFirebaseStub() {
  // importScripts is a no-op in Node
  global.importScripts = jest.fn();

  // Stub firebase global — calling firebase.messaging() registers an internal
  // push listener that also calls self.registration.showNotification, just
  // like the real Firebase compat SDK does in a service worker.
  global.firebase = {
    initializeApp: jest.fn(),
    messaging: jest.fn(() => {
      // This simulates what the Firebase compat SDK does internally:
      // it registers its own push listener that shows a notification.
      self.addEventListener('push', async (event) => {
        if (!event.data) return;
        let payload;
        try { payload = event.data.json(); } catch { return; }

        const notification = payload.notification || {};
        const title = notification.title || 'Firebase Notification';
        const body = notification.body || '';

        // Firebase's internal handler calls showNotification
        await self.registration.showNotification(title, { body, tag: 'firebase-internal' });
      });
    }),
  };
}

// ---------------------------------------------------------------------------
// Load the unfixed service worker script in the current Node context
// ---------------------------------------------------------------------------

function loadServiceWorker() {
  // The SW uses importScripts (no-op) and references self/firebase globals.
  // We evaluate the SW file directly after setting up globals.
  const fs = require('fs');
  const path = require('path');
  const swPath = path.resolve(__dirname, '../public/firebase-messaging-sw.js');
  const swCode = fs.readFileSync(swPath, 'utf8');

  // Replace importScripts calls (already mocked, but eval needs them gone)
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
    data: {
      json: () => payload,
    },
    waitUntil: (p) => waitUntilPromises.push(p),
    _flush: () => Promise.all(waitUntilPromises),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SW Bug Condition — Duplicate Notification (unfixed code)', () => {
  beforeEach(() => {
    resetSWGlobals();
    setupFirebaseStub();
    jest.resetModules();
    loadServiceWorker();
  });

  /**
   * Validates: Requirements 1.1
   *
   * EXPECTED OUTCOME on unfixed code: FAIL
   * showNotification is called TWICE — once by firebase.messaging()'s internal
   * push listener and once by the manual self.addEventListener('push', ...) block.
   *
   * Counterexample: showNotification called 2 times for one push event.
   */
  test('showNotification is called exactly once per push event', async () => {
    const payload = {
      notification: {
        title: 'Hospital Token Update',
        body: 'Token 42: 5 patients ahead. Please be ready.',
      },
      data: {
        title: 'Hospital Token Update',
        body: 'Token 42: 5 patients ahead. Please be ready.',
        tokenNumber: '42',
        stage: '1',
        url: '/',
      },
    };

    const event = makePushEvent(payload);

    // Dispatch to all registered push listeners (both Firebase internal + manual)
    for (const listener of pushListeners) {
      await listener(event);
    }
    await event._flush();

    // On UNFIXED code this assertion FAILS because showNotification is called twice.
    expect(showNotificationMock).toHaveBeenCalledTimes(1);
  });
});
