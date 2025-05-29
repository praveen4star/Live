const express = require("express");
const router = express.Router();
const { param, validationResult } = require("express-validator");

/**
 * Get all VODs
 * @route GET /api/vod
 */
router.get("/", (req, res) => {
  // Get streams reference from hooks controller
  const streams = require("./hooksController").streams || [];

  // Filter streams with VOD data
  const vods = streams
    .filter((stream) => stream.vod)
    .map((stream) => ({
      id: stream.id,
      name: stream.name,
      description: stream.description,
      status: stream.vod ? "ready" : "processing",
      createdAt: stream.endedAt,
      duration:
        stream.endedAt && stream.startedAt
          ? new Date(stream.endedAt) - new Date(stream.startedAt)
          : null,
    }));

  res.json({ vods });
});

/**
 * Get a VOD by ID
 * @route GET /api/vod/:id
 */
router.get("/:id", [param("id").isString().trim().notEmpty()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Get streams reference from hooks controller
  const streams = require("./hooksController").streams || [];

  // Find the stream with the matching ID and VOD data
  const stream = streams.find((s) => s.id === req.params.id && s.vod);

  if (!stream) {
    return res.status(404).json({ error: true, message: "VOD not found" });
  }

  // Construct VOD data
  const vod = {
    id: stream.id,
    name: stream.name,
    description: stream.description,
    status: stream.vod ? "ready" : "processing",
    createdAt: stream.endedAt,
    duration:
      stream.endedAt && stream.startedAt
        ? new Date(stream.endedAt) - new Date(stream.startedAt)
        : null,
    urls: {
      hls: `/vod/${stream.id}/index.m3u8`,
      thumbnail: `/vod/${stream.id}/thumbnail.jpg`,
    },
  };

  res.json({ vod });
});

/**
 * Delete a VOD
 * @route DELETE /api/vod/:id
 */
router.delete(
  "/:id",
  [param("id").isString().trim().notEmpty()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Get streams reference from hooks controller
    const streams = require("./hooksController").streams || [];

    // Find the stream with the matching ID
    const streamIndex = streams.findIndex((s) => s.id === req.params.id);

    if (streamIndex === -1 || !streams[streamIndex].vod) {
      return res.status(404).json({ error: true, message: "VOD not found" });
    }

    // Remove VOD data
    streams[streamIndex].vod = null;

    // In a real implementation, you would also delete the VOD files from disk
    // For example:
    // fs.rm(`${VOD_PATH}/${req.params.id}`, { recursive: true, force: true }, (err) => {
    //   if (err) console.error(`Error deleting VOD files: ${err}`);
    // });

    res.json({ success: true, message: "VOD deleted" });
  }
);

module.exports = router;
