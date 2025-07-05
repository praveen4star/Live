const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import controllers
const authController = require("./controllers/authController");
const hooksController = require("./controllers/hooksController");
const edgeController = require("./controllers/edgeController");

// API Routes
app.use("/api/auth", authController);
app.use("/api/hooks", hooksController);
app.use("/api/edge", edgeController);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      auth: "active",
      hooks: "active",
      edge: "active",
    },
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "OvenMediaEngine Backend API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      hooks: "/api/hooks",
      edge: "/api/edge",
      health: "/health",
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  - Authentication: http://localhost:${PORT}/api/auth`);
  console.log(`  - Webhooks: http://localhost:${PORT}/api/hooks`);
  console.log(`  - Edge Management: http://localhost:${PORT}/api/edge`);
  console.log(`  - Health Check: http://localhost:${PORT}/health`);
});

module.exports = app;
