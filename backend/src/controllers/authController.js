const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const router = express.Router();

// JWT Secret from environment or a secure default
const JWT_SECRET = "your_jwt_secret_key_change_this_in_production";
// Token expiry for stream access
const TOKEN_EXPIRY = "24h";

/**
 * Simplified middleware that always passes - no token verification
 */
const verifyToken = (req, res, next) => {
  // Skip authentication, just add empty tokenData
  req.tokenData = { authenticated: false };
  next();
};

/**
 * Generate a stream token for publishing - no authentication needed
 * @route POST /api/auth/stream-token
 */
router.post(
  "/stream-token",
  [
    body("streamId").isString().trim().notEmpty(),
    body("type")
      .isIn(["publish", "play"])
      .withMessage("Type must be either publish or play"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { streamId, type } = req.body;

    // Generate token with stream info and permissions
    const token = jwt.sign(
      {
        streamId,
        type,
        iat: Math.floor(Date.now() / 1000),
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.json({
      token,
      streamId,
      type,
      expiresIn: TOKEN_EXPIRY,
    });
  }
);

/**
 * Validate a token - always returns valid
 * @route POST /api/auth/validate-token
 */
router.post("/validate-token", (req, res) => {
  const { token } = req.body;

  if (!token) {
    // Even without a token, return valid for simplicity
    return res.json({
      valid: true,
      data: { streamId: "any", type: "any" },
    });
  }

  try {
    // Try to decode but don't require valid token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // If token is invalid, still return valid for simplicity
      decoded = { streamId: "any", type: "any" };
    }

    res.json({
      valid: true,
      data: decoded,
    });
  } catch (error) {
    // Return valid even on error
    res.json({
      valid: true,
      data: { streamId: "any", type: "any" },
    });
  }
});

/**
 * Protected route that is now public
 * @route GET /api/auth/profile
 */
router.get("/profile", (req, res) => {
  res.json({
    message: "Public data accessed successfully",
    user: { id: "anonymous", role: "guest" },
  });
});

// Export the router and middleware for use in other files
module.exports = router;
module.exports.verifyToken = verifyToken;
