const express = require("express");
const router = express.Router();

// In-memory streams store (reference to the same store from streamController)
// In a real application, use a database instead
let streams = [];

/**
 * Webhook for stream publishing start validation - no auth validation
 * @route POST /hooks/on_publish
 */
router.post("/on_publish", (req, res) => {
  console.log("Stream publish webhook received:", req.body);

  try {
    const { app, stream } = req.body;

    if (!app || !stream) {
      return res.status(400).send("Bad request");
    }

    // Extract stream ID from URL parameters
    const streamId = stream;

    // Always allow publishing (no auth check)
    console.log(`Publishing allowed for stream: ${streamId}`);

    // Find the stream in our database
    const streamRecord = streams.find((s) => s.id === streamId);

    if (streamRecord) {
      // Update stream status to live
      streamRecord.status = "live";
      streamRecord.startedAt = new Date().toISOString();
    } else {
      // Create a new stream record if it doesn't exist
      const newStream = {
        id: streamId,
        name: `Stream ${streamId}`,
        description: "Auto-created stream",
        status: "live",
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        endedAt: null,
        vod: null,
      };
      streams.push(newStream);
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Error in on_publish webhook:", error);
    // Always return 200 to allow publishing
    return res.status(200).send("OK");
  }
});

/**
 * Webhook for stream publishing end
 * @route POST /hooks/on_publish_done
 */
router.post("/on_publish_done", (req, res) => {
  console.log("Stream publish done webhook received:", req.body);

  try {
    const { app, stream } = req.body;

    if (!app || !stream) {
      return res.status(400).send("Bad request");
    }

    const streamId = stream;
    const streamRecord = streams.find((s) => s.id === streamId);

    if (streamRecord) {
      // Update stream status to ended
      streamRecord.status = "ended";
      streamRecord.endedAt = new Date().toISOString();

      // If recording was enabled, add VOD info
      if (streamRecord.record) {
        streamRecord.vod = {
          path: `/vod/${streamId}/index.m3u8`,
          createdAt: new Date().toISOString(),
        };
      }
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Error in on_publish_done webhook:", error);
    return res.status(200).send("OK");
  }
});

/**
 * Webhook for stream recording
 * @route POST /hooks/on_record_done
 */
router.post("/on_record_done", (req, res) => {
  console.log("Stream record done webhook received:", req.body);

  try {
    const { app, stream, file } = req.body;

    if (!app || !stream || !file) {
      return res.status(400).send("Bad request");
    }

    const streamId = stream;
    const streamRecord = streams.find((s) => s.id === streamId);

    if (streamRecord) {
      // Update VOD info
      streamRecord.vod = {
        path: `/vod/${streamId}/index.m3u8`,
        file: file,
        createdAt: new Date().toISOString(),
      };
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Error in on_record_done webhook:", error);
    return res.status(200).send("OK");
  }
});

// Share the streams array with other modules
module.exports = router;
module.exports.streams = streams;
