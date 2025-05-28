const express = require("express");
const cors = require("cors");
const NodeMediaServer = require("node-media-server");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const dotenv = require("dotenv");
const NodeTransServer = require("node-media-server/src/node_trans_server");

dotenv.config();

// Create live streams directory if it doesn't exist
const streamsDir = path.join(__dirname, "media", "live");
if (!fs.existsSync(streamsDir)) {
  fs.mkdirSync(streamsDir, { recursive: true });
}

// Create thumbnails directory if it doesn't exist
const thumbnailsDir = path.join(__dirname, "public", "thumbnails");
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

// RTMP Server Configuration
const rtmpConfig = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000,
    mediaroot: "./media",
    allow_origin: "*",
    api: true,
  },
  auth: {
    api: false,
    play: false,
    publish: false,
  },
  trans: {
    ffmpeg: "/opt/homebrew/bin/ffmpeg",
    tasks: [
      {
        app: "live",
        hls: true,
        hlsFlags:
          "[hls_time=1:hls_list_size=3:hls_flags=delete_segments+append_list+low_latency_mode]",
        hlsKeep: false,
        mp4: false,
        dash: false,
      },
    ],
  },
  relay: {
    ffmpeg: "/opt/homebrew/bin/ffmpeg",
    tasks: [
      {
        app: "live",
        mode: "push",
        edge: "rtmp://localhost:1935/live/test",
        id: "test_stream",
        relay_audio: true,
        relay_video: true,
      },
    ],
  },
};

// Monkey patch to fix the version error in node-media-server
const originalRun = NodeTransServer.prototype.run;
NodeTransServer.prototype.run = function () {
  // Add missing version variable
  global.version = "2.7.4"; // Use the version from the error message
  // Call the original run method
  return originalRun.call(this);
};

// Initialize RTMP Server
const nms = new NodeMediaServer(rtmpConfig);
nms.run();

// Log when FFmpeg is found
exec("which ffmpeg", (error, stdout, stderr) => {
  if (error) {
    console.warn("⚠️ FFmpeg not found. Transcoding features will be disabled.");
    console.warn("To enable transcoding features, please install FFmpeg:");
    console.warn("- For macOS: brew install ffmpeg");
    console.warn("- For Ubuntu/Debian: apt-get install ffmpeg");
    console.warn(
      "- For Windows: download from https://ffmpeg.org/download.html"
    );
  } else {
    const ffmpegPath = stdout.trim();
    console.log(`✅ FFmpeg found at: ${ffmpegPath}`);
    console.log(`Using FFmpeg path in config: ${rtmpConfig.trans.ffmpeg}`);

    // Check if the HLS directory exists
    const hlsDir = path.join(__dirname, "media", "live");
    if (fs.existsSync(hlsDir)) {
      console.log(`HLS directory exists at: ${hlsDir}`);
      // List contents to verify
      try {
        const items = fs.readdirSync(hlsDir);
        console.log(`HLS directory contents: ${items.length} items`);
        if (items.length > 0) {
          console.log(`First few items: ${items.slice(0, 5).join(", ")}`);
        }
      } catch (err) {
        console.error(`Error reading HLS directory: ${err.message}`);
      }
    } else {
      console.warn(`HLS directory does not exist at: ${hlsDir}`);
      try {
        fs.mkdirSync(hlsDir, { recursive: true });
        console.log(`Created HLS directory at: ${hlsDir}`);
      } catch (err) {
        console.error(`Error creating HLS directory: ${err.message}`);
      }
    }
  }
});

// Handle RTMP events
nms.on("preConnect", (id, args) => {
  console.log("[NodeEvent on preConnect]", `id=${id}`, args);
});

nms.on("postConnect", (id, args) => {
  console.log("[NodeEvent on postConnect]", `id=${id}`, args);
});

nms.on("prePublish", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on prePublish]",
    `id=${id} StreamPath=${StreamPath}`,
    args
  );

  // Extract stream key from path (e.g., /live/streamKey)
  const pathParts = StreamPath.split("/");
  if (pathParts.length >= 3) {
    const streamKey = pathParts[2];

    // Check if stream exists in our records
    if (streamKey && activeStreams[streamKey]) {
      // Mark stream as live
      activeStreams[streamKey].isLive = true;
      console.log(`Stream ${streamKey} is now live`);
    } else {
      console.log(`No registered stream found with key: ${streamKey}`);
    }
  }
});

// Add event listener for stream segments
nms.on("postHLS", (id, StreamPath, filename) => {
  console.log(
    `[HLS] New segment created: ${filename} for stream: ${StreamPath}`
  );

  // Check if we need to create the directory structure
  const streamKey = StreamPath.split("/")[2];
  const streamDir = path.join(__dirname, "media", "live", streamKey);

  if (!fs.existsSync(streamDir)) {
    console.log(`Creating directory for stream: ${streamKey}`);
    fs.mkdirSync(streamDir, { recursive: true });
  }
});

// Add event listener for RTMP data events
nms.on("doneFrame", (id, StreamPath, rtmpHeader, rtmpBody) => {
  // Log only occasionally to avoid excessive output
  if (Math.random() < 0.01) {
    // Log only 1% of frames
    console.log(`[RTMP Frame] Received frame for stream: ${StreamPath}`);
  }
});

nms.on("donePublish", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on donePublish]",
    `id=${id} StreamPath=${StreamPath}`,
    args
  );

  // Extract stream key from path
  const pathParts = StreamPath.split("/");
  if (pathParts.length >= 3) {
    const streamKey = pathParts[2];

    // Check if stream exists in our records
    if (streamKey && activeStreams[streamKey]) {
      // Mark stream as not live
      activeStreams[streamKey].isLive = false;
      console.log(`Stream ${streamKey} is no longer live`);
    }
  }
});

// Add additional event listeners
nms.on("postPublish", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on postPublish]",
    `id=${id} StreamPath=${StreamPath}`
  );

  // Extract stream key from path
  const pathParts = StreamPath.split("/");
  if (pathParts.length >= 3) {
    const streamKey = pathParts[2];

    // Auto-create a stream entry if it doesn't exist
    if (!activeStreams[streamKey]) {
      console.log(`Auto-creating stream for key: ${streamKey}`);
      const streamId = Date.now().toString();
      const newStream = {
        id: streamId,
        title: `Stream ${streamKey}`,
        description: "Auto-generated stream",
        streamKey: streamKey,
        username: "Anonymous",
        startedAt: new Date().toISOString(),
        viewCount: 0,
        isLive: true,
      };

      activeStreams[streamKey] = newStream;
    }
  }
});

// Express API Server
const app = express();

// Configure CORS to allow access to HLS streams
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
  })
);

// Add headers to allow access to HLS streams
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  next();
});

app.use(express.json());
app.use(express.static("public"));

// In-memory storage for active streams
const activeStreams = {};

// API Routes
app.get("/api/streams", (req, res) => {
  const streams = Object.values(activeStreams);
  res.json({ streams });
});

app.post("/api/streams", (req, res) => {
  const { title, description, streamKey, username } = req.body;

  if (!title || !streamKey || !username) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const streamId = Date.now().toString();
  const newStream = {
    id: streamId,
    title,
    description,
    streamKey,
    username,
    startedAt: new Date().toISOString(),
    viewCount: 0,
    isLive: false,
  };

  activeStreams[streamKey] = newStream;

  res.status(201).json(newStream);
});

// Route to mark a stream as live
app.put("/api/streams/:streamKey/live", (req, res) => {
  const { streamKey } = req.params;

  if (!activeStreams[streamKey]) {
    return res.status(404).json({ error: "Stream not found" });
  }

  activeStreams[streamKey].isLive = true;

  res.json(activeStreams[streamKey]);
});

// Route to increment view count
app.put("/api/streams/:streamKey/view", (req, res) => {
  const { streamKey } = req.params;

  if (!activeStreams[streamKey]) {
    return res.status(404).json({ error: "Stream not found" });
  }

  activeStreams[streamKey].viewCount += 1;

  res.json({ viewCount: activeStreams[streamKey].viewCount });
});

// Route to end a stream
app.delete("/api/streams/:streamKey", (req, res) => {
  const { streamKey } = req.params;

  if (!activeStreams[streamKey]) {
    return res.status(404).json({ error: "Stream not found" });
  }

  const stream = activeStreams[streamKey];
  delete activeStreams[streamKey];

  res.json({ message: "Stream ended", stream });
});

// Get stream details
app.get("/api/streams/:streamKey", (req, res) => {
  const { streamKey } = req.params;

  if (!activeStreams[streamKey]) {
    return res.status(404).json({ error: "Stream not found" });
  }

  res.json(activeStreams[streamKey]);
});

// Route to manually create a test HLS stream
app.get("/api/generate-test-stream", (req, res) => {
  console.log("Generating test HLS stream...");

  // Create test directory if it doesn't exist
  const testDir = path.join(__dirname, "media", "live", "test");
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Create a basic HLS index file
  const indexFile = path.join(testDir, "index.m3u8");
  const testContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:4.000000,
test0.ts
#EXTINF:4.000000,
test1.ts
#EXTINF:4.000000,
test2.ts
#EXT-X-ENDLIST`;

  fs.writeFileSync(indexFile, testContent);

  // Generate sample TS segments using ffmpeg
  const ffmpegCmd = `/opt/homebrew/bin/ffmpeg -f lavfi -i testsrc=duration=12:size=640x360:rate=30 -f lavfi -i sine=frequency=1000:duration=12 -c:v libx264 -c:a aac -pix_fmt yuv420p -f hls -hls_time 4 -hls_playlist_type vod -hls_segment_filename "${testDir}/test%d.ts" "${testDir}/index.m3u8"`;

  exec(ffmpegCmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error generating test stream: ${error}`);
      return res.status(500).json({ error: "Failed to generate test stream" });
    }

    console.log(`Test stream generated successfully in ${testDir}`);

    // Create or update the test stream in our records
    activeStreams["test"] = {
      id: "test",
      title: "Test Stream",
      description: "Auto-generated test stream",
      streamKey: "test",
      username: "System",
      startedAt: new Date().toISOString(),
      viewCount: 0,
      isLive: true,
    };

    res.json({
      message: "Test stream generated successfully",
      path: "/live/test/index.m3u8",
    });
  });
});

// Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
  console.log(`RTMP Server running on port 1935`);
  console.log(`HLS Server running on port 8000`);

  // Automatically generate test stream
  generateTestStream();
});

// Function to generate test stream
function generateTestStream() {
  console.log("Automatically generating test HLS stream...");

  // Create test directory if it doesn't exist
  const testDir = path.join(__dirname, "media", "live", "test");
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Create a basic HLS index file
  const indexFile = path.join(testDir, "index.m3u8");
  const testContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:4.000000,
test0.ts
#EXTINF:4.000000,
test1.ts
#EXTINF:4.000000,
test2.ts
#EXT-X-ENDLIST`;

  fs.writeFileSync(indexFile, testContent);

  // Generate sample TS segments using ffmpeg
  const ffmpegCmd = `/opt/homebrew/bin/ffmpeg -f lavfi -i testsrc=duration=12:size=640x360:rate=30 -f lavfi -i sine=frequency=1000:duration=12 -c:v libx264 -c:a aac -pix_fmt yuv420p -f hls -hls_time 4 -hls_playlist_type vod -hls_segment_filename "${testDir}/test%d.ts" "${testDir}/index.m3u8"`;

  exec(ffmpegCmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error generating test stream: ${error}`);
      return;
    }

    console.log(`Test stream generated successfully in ${testDir}`);

    // Create or update the test stream in our records
    activeStreams["test"] = {
      id: "test",
      title: "Test Stream",
      description: "Auto-generated test stream",
      streamKey: "test",
      username: "System",
      startedAt: new Date().toISOString(),
      viewCount: 0,
      isLive: true,
    };
  });
}

const playerOptions = {
  liveui: true,
  liveTracker: {
    trackingThreshold: 0.25,
    liveTolerance: 0.5,
  },
  html5: {
    vhs: {
      overrideNative: true,
      lowLatencyMode: true,
      useBandwidthFromLocalStorage: true,
      enableLowInitialPlaylist: true,
      bufferSize: 0.1,
      liveBackBufferLength: 10,
    },
  },
};
