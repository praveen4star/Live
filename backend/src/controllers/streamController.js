const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { body, param, validationResult } = require("express-validator");
const axios = require("axios");
const router = express.Router();

// In-memory streams store (replace with database in production)
let streams = [];

// OME API URL from environment
const OME_API_URL = process.env.OME_API_URL || "http://ome:8081";

/**
 * Get all streams
 * @route GET /api/streams
 */
router.get("/", (req, res) => {
  // Filter sensitive data before sending
  const filteredStreams = streams.map((stream) => ({
    id: stream.id,
    name: stream.name,
    status: stream.status,
    createdAt: stream.createdAt,
    startedAt: stream.startedAt,
    endedAt: stream.endedAt,
    vod: stream.vod,
  }));

  res.json({ streams: filteredStreams });
});

/**
 * Get a stream by ID
 * @route GET /api/streams/:id
 */
router.get("/:id", [param("id").isString().trim().notEmpty()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const stream = streams.find((s) => s.id === req.params.id);

  if (!stream) {
    return res.status(404).json({ error: true, message: "Stream not found" });
  }

  // Filter sensitive data
  const { streamKey, ...filteredStream } = stream;
  res.json({ stream: filteredStream });
});

/**
 * Create a new stream
 * @route POST /api/streams
 */
router.post(
  "/",
  [
    body("name").isString().trim().notEmpty(),
    body("description").optional().isString(),
    body("record").optional().isBoolean(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description = "", record = false } = req.body;
    const streamId = uuidv4();
    const streamKey = uuidv4();

    const newStream = {
      id: streamId,
      name,
      description,
      streamKey,
      status: "idle", // idle, live, ended
      record,
      createdAt: new Date().toISOString(),
      startedAt: null,
      endedAt: null,
      vod: null,
    };

    streams.push(newStream);

    // Return the stream without sensitive data
    const { streamKey: _, ...filteredStream } = newStream;
    res.status(201).json({ stream: filteredStream });
  }
);

/**
 * Get stream key
 * @route GET /api/streams/:id/key
 */
router.get(
  "/:id/key",
  [param("id").isString().trim().notEmpty()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const stream = streams.find((s) => s.id === req.params.id);

    if (!stream) {
      return res.status(404).json({ error: true, message: "Stream not found" });
    }

    res.json({ streamKey: stream.streamKey });
  }
);

/**
 * Get playback URLs
 * @route GET /api/streams/:id/playback
 */
router.get(
  "/:id/playback",
  [param("id").isString().trim().notEmpty()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const stream = streams.find((s) => s.id === req.params.id);

    if (!stream) {
      return res.status(404).json({ error: true, message: "Stream not found" });
    }

    // Generate playback URLs based on environment variables or defaults
    const baseHlsUrl = process.env.HLS_BASE_URL || "http://localhost:8080";
    const baseWebRtcUrl = process.env.WEBRTC_BASE_URL || "ws://localhost:3333";
    const applicationName = process.env.OME_APP_NAME || "app";

    const playbackUrls = {
      hls: `${baseHlsUrl}/${applicationName}/${stream.id}/llhls.m3u8`,
      webrtc: `${baseWebRtcUrl}/${applicationName}/${stream.id}`,
      rtmp: `rtmp://${
        process.env.RTMP_HOST || "localhost"
      }:1935/${applicationName}/${stream.id}`,
    };

    res.json({ playbackUrls });
  }
);

/**
 * Delete a stream
 * @route DELETE /api/streams/:id
 */
router.delete(
  "/:id",
  [param("id").isString().trim().notEmpty()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const streamIndex = streams.findIndex((s) => s.id === req.params.id);

    if (streamIndex === -1) {
      return res.status(404).json({ error: true, message: "Stream not found" });
    }

    // Try to stop the stream in OME if it's running
    const streamId = streams[streamIndex].id;
    axios
      .delete(
        `${OME_API_URL}/v1/vhosts/default/apps/${
          process.env.OME_APP_NAME || "app"
        }/streams/${streamId}`
      )
      .catch((error) => {
        console.error("Error stopping stream in OME:", error.message);
      });

    streams.splice(streamIndex, 1);

    res.json({ success: true, message: "Stream deleted" });
  }
);

module.exports = router;
