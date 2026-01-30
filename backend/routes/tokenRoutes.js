const express = require("express");
const router = express.Router();
const Token = require("../models/Token");
const tokenControllers = require("../controllers/tokenControllers");

/**
 * POST /api/tokens/generate
 * Generate a new token
 */
router.post("/generate", tokenControllers.generateToken);

/**
 * POST /api/tokens/complete
 * Complete the current token and activate next
 */
router.post("/complete", tokenControllers.completeToken);

/**
 * GET /api/tokens/current
 * Get active token and upcoming tokens
 */
router.get("/current", tokenControllers.currentToken);

/**
 * GET /api/tokens/last-generated
 * Get last generated token
 */
router.get("/last-generated", tokenControllers.lastGeneratedToken);

/**
 * POST /api/tokens/reset
 * Reset all tokens and start over
 */
router.post("/reset", tokenControllers.resetTokens);

router.post("/confirm-issued", tokenControllers.confirmIssued);

module.exports = router;
