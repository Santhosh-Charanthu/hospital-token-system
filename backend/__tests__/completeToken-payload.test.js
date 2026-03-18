/**
 * Bug Condition Exploration Test — Task 1, Sub-task 2
 * Property 1: Bug Condition - Mobile Delivery Failure
 *
 * Validates: Requirements 1.2
 *
 * CRITICAL: This test MUST FAIL on unfixed code.
 * Failure confirms the mobile delivery bug exists (top-level `notification`
 * field is present in the FCM payload, which prevents delivery on mobile).
 * DO NOT fix the test or the code when it fails.
 *
 * Expected counterexample: payload.notification exists when it should not.
 */

// ---------------------------------------------------------------------------
// Capture the payload passed to admin.messaging().send()
// ---------------------------------------------------------------------------

let capturedPayload = null;
const mockSend = jest.fn();

// ---------------------------------------------------------------------------
// Mock dependencies before requiring the controller
// ---------------------------------------------------------------------------

jest.mock('../config/firebaseAdmin', () => ({
  messaging: () => ({ send: mockSend }),
}));

// Tokens
const mockActiveToken = {
  status: 'ACTIVE',
  tokenNumber: 5,
  save: jest.fn().mockResolvedValue(undefined),
};
const mockNextToken = {
  status: 'WAITING',
  tokenNumber: 6,
  save: jest.fn().mockResolvedValue(undefined),
};

// A subscribed alert: patientTokenNumber=11, currentTokenNumber=6, diff=5 → stage 1
const mockAlert = {
  patientTokenNumber: 11,
  stage: 0,
  deviceToken: 'mock-device-token-abc123',
  save: jest.fn().mockResolvedValue(undefined),
};

// Helper: returns a query-like object that supports .sort() chaining
function queryResolving(value) {
  const q = Promise.resolve(value);
  q.sort = () => q;
  return q;
}

jest.mock('../models/Token', () => {
  const Token = jest.fn();
  Token.findOne = jest.fn();
  Token.find = jest.fn();
  return Token;
});

jest.mock('../models/TokenAlert', () => {
  const TokenAlert = jest.fn();
  TokenAlert.find = jest.fn();
  return TokenAlert;
});

// ---------------------------------------------------------------------------
// Load the controller under test (after mocks are set up)
// ---------------------------------------------------------------------------

const tokenControllers = require('../controllers/tokenControllers');
const Token = require('../models/Token');
const TokenAlert = require('../models/TokenAlert');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReqRes() {
  const req = {
    app: {
      get: jest.fn(() => ({ emit: jest.fn() })),
    },
  };
  const res = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('completeToken — FCM payload structure (unfixed code)', () => {
  beforeEach(() => {
    capturedPayload = null;
    mockSend.mockReset();
    mockSend.mockImplementation((payload) => {
      capturedPayload = payload;
      return Promise.resolve('mock-message-id');
    });

    mockActiveToken.save.mockResolvedValue(undefined);
    mockNextToken.save.mockResolvedValue(undefined);
    mockAlert.save.mockResolvedValue(undefined);
    mockAlert.stage = 0;

    // completeToken calls Token.findOne twice:
    //   1st: { status: "ACTIVE" }  → mockActiveToken
    //   2nd: { status: "WAITING" }.sort(...) → mockNextToken
    // emitTokenUpdate (called at the end) also calls Token.findOne once more
    Token.findOne
      .mockReturnValueOnce(queryResolving(mockActiveToken))   // ACTIVE
      .mockReturnValueOnce(queryResolving(mockNextToken))     // WAITING (next)
      .mockReturnValueOnce(queryResolving(mockNextToken));    // emitTokenUpdate ACTIVE

    // Token.find used by emitTokenUpdate for upcomingTokens
    Token.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    });

    // TokenAlert.find returns one alert qualifying for stage 1
    TokenAlert.find.mockResolvedValue([mockAlert]);
  });

  /**
   * Validates: Requirements 1.2
   *
   * EXPECTED OUTCOME on unfixed code: FAIL
   * The FCM payload sent by completeToken contains a top-level `notification`
   * field, which causes FCM to intercept the push event on mobile before the
   * service worker can handle it — resulting in no notification on Android
   * Chrome / iOS PWA.
   *
   * Counterexample: payload.notification exists when it should not.
   */
  test('admin.messaging().send() is called with NO top-level notification field', async () => {
    const { req, res } = makeReqRes();

    await tokenControllers.completeToken(req, res);

    // Verify send was actually called (proves the alert path was reached)
    expect(mockSend).toHaveBeenCalled();
    expect(capturedPayload).not.toBeNull();

    // On UNFIXED code this assertion FAILS because capturedPayload.notification
    // is present (the top-level notification field exists).
    expect(capturedPayload).not.toHaveProperty('notification');
  });

  test('admin.messaging().send() payload retains webpush.notification and data fields', async () => {
    const { req, res } = makeReqRes();

    await tokenControllers.completeToken(req, res);

    expect(mockSend).toHaveBeenCalled();
    expect(capturedPayload).not.toBeNull();

    // These fields must always be present (regression check)
    expect(capturedPayload).toHaveProperty('webpush.notification');
    expect(capturedPayload).toHaveProperty('data');
    expect(capturedPayload.data).toHaveProperty('title');
    expect(capturedPayload.data).toHaveProperty('body');
    expect(capturedPayload.data).toHaveProperty('tokenNumber');
    expect(capturedPayload.data).toHaveProperty('stage');
  });
});
