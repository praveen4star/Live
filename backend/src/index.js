require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");

// Import routes
const streamRoutes = require("./controllers/streamController");
const authRoutes = require("./controllers/authController");
const hooksRoutes = require("./controllers/hooksController");
const vodRoutes = require("./controllers/vodController");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Apply middleware with expanded CORS settings
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(morgan("combined"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB (optional, for production setups)
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("MongoDB connection error:", err));
}

// Local VOD storage path
const LOCAL_VOD_PATH = process.env.LOCAL_VOD_PATH || "/app/vod";

// Serve VOD files from local storage
app.use("/vod", express.static(LOCAL_VOD_PATH));

// Register routes
app.use("/api/streams", streamRoutes);
app.use("/api/auth", authRoutes);
app.use("/hooks", hooksRoutes);
app.use("/api/vod", vodRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP" });
});

// Simple test endpoint
app.get("/test", (req, res) => {
  res.status(200).json({ message: "Backend is working!" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: true,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
