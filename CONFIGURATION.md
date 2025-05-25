# LiveTube Configuration Guide

This document provides detailed information about configuring the LiveTube streaming platform for optimal performance and customization.

## Table of Contents

- [RTMP Server Configuration](#rtmp-server-configuration)
- [HLS Configuration](#hls-configuration)
- [FFmpeg Configuration](#ffmpeg-configuration)
- [Stream Relay Configuration](#stream-relay-configuration)
- [Express Server Configuration](#express-server-configuration)
- [Video Player Configuration](#video-player-configuration)
- [Environment Variables](#environment-variables)
- [Advanced Configurations](#advanced-configurations)

## RTMP Server Configuration

The RTMP server is configured in `index.js` using the `rtmpConfig` object. Here's a detailed explanation of each property:

```javascript
const rtmpConfig = {
  rtmp: {
    port: 1935, // Standard RTMP port
    chunk_size: 60000, // Size of RTMP chunks in bytes
    gop_cache: true, // Enable Group of Pictures caching for smoother playback
    ping: 30, // Ping clients every 30 seconds
    ping_timeout: 60, // Disconnect if no response in 60 seconds
  },
  http: {
    port: 8000, // HTTP port for HLS delivery
    mediaroot: "./media", // Media storage directory
    allow_origin: "*", // CORS policy
    api: true, // Enable HTTP API
  },
  auth: {
    api: false, // No authentication for API
    play: false, // No authentication for playback
    publish: false, // No authentication for publishing
  },
  trans: {
    ffmpeg: "/opt/homebrew/bin/ffmpeg", // FFmpeg executable path
    tasks: [
      {
        app: "live",
        hls: true, // Enable HLS transcoding
        hlsFlags:
          "[hls_time=2:hls_list_size=5:hls_flags=delete_segments+append_list]",
        hlsKeep: false, // Don't keep HLS segments after stream ends
        mp4: false, // Don't create MP4 recordings
        dash: false, // Don't create DASH streams
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
```

### Adjusting RTMP Parameters

#### Timeouts and Ping

```javascript
rtmp: {
  ping: 30,                 // How often to ping clients (seconds)
  ping_timeout: 60,         // How long to wait for ping response (seconds)
}
```

- For unstable connections, increase `ping_timeout` to 120 seconds
- For more responsive disconnection detection, reduce `ping` to 15 seconds

#### Chunk Size

```javascript
rtmp: {
  chunk_size: 60000,        // Size of RTMP chunks in bytes
}
```

- Larger chunk sizes (80000-100000) can improve throughput on high-bandwidth connections
- Smaller chunk sizes (30000-40000) can reduce latency but may increase CPU usage

#### GOP Cache

```javascript
rtmp: {
  gop_cache: true,          // Enable Group of Pictures caching
}
```

- Set to `true` for smoother playback start
- Set to `false` for lower latency but possibly rougher playback start

## HLS Configuration

The HLS configuration is defined in the `trans.tasks` array:

```javascript
hlsFlags: "[hls_time=2:hls_list_size=5:hls_flags=delete_segments+append_list]",
```

### Key HLS Parameters

#### hls_time

- **Definition**: Duration of each HLS segment in seconds
- **Default**: 2 seconds
- **Recommended Range**: 1-4 seconds
- **Effects**:
  - Lower values (1-2s): Reduce latency but may increase network overhead
  - Higher values (3-4s): More stable playback but higher latency

#### hls_list_size

- **Definition**: Number of segments kept in the playlist
- **Default**: 5 segments
- **Recommended Range**: 3-10 segments
- **Effects**:
  - Lower values (3-5): Lower latency but less buffer for network issues
  - Higher values (6-10): More stable playback with network fluctuations

#### hls_flags

- **delete_segments**: Automatically delete old segments
- **append_list**: Append to playlist instead of overwriting
- **low_latency**: Enable low latency optimizations (reduces latency)
- **discont_start**: Mark first segment as discontinuous
- **omit_endlist**: Don't add EXT-X-ENDLIST tag to playlist (for live)

### Low Latency HLS Configuration

For minimal latency (2-3 seconds), use:

```javascript
hlsFlags: "[hls_time=1:hls_list_size=3:hls_flags=delete_segments+append_list+low_latency+omit_endlist]",
```

### Stable HLS Configuration

For more stable playback with higher latency (5-10 seconds), use:

```javascript
hlsFlags: "[hls_time=4:hls_list_size=8:hls_flags=delete_segments+append_list]",
```

## FFmpeg Configuration

### FFmpeg Path

Ensure the FFmpeg path is correct for your operating system:

- **macOS with Homebrew**: `/opt/homebrew/bin/ffmpeg` or `/usr/local/bin/ffmpeg`
- **Linux**: `/usr/bin/ffmpeg`
- **Windows**: `C:\\ffmpeg\\bin\\ffmpeg.exe`

You can find your FFmpeg path by running:

```bash
which ffmpeg  # macOS/Linux
where ffmpeg  # Windows
```

### FFmpeg Additional Options

You can add additional FFmpeg options for transcoding by modifying the tasks array:

```javascript
tasks: [
  {
    app: "live",
    hls: true,
    hlsFlags: "[hls_time=2:hls_list_size=5:hls_flags=delete_segments+append_list]",
    // Add custom FFmpeg options
    customArgs: "-c:v libx264 -profile:v main -preset veryfast -b:v 2500k -maxrate 2500k -bufsize 5000k -c:a aac -b:a 128k -ac 2 -ar 44100",
  },
],
```

Common custom arguments:

- **Video Codec**: `-c:v libx264`
- **Video Profile**: `-profile:v main`
- **Encoding Speed**: `-preset veryfast` (options: ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow)
- **Video Bitrate**: `-b:v 2500k`
- **Audio Codec**: `-c:a aac`
- **Audio Bitrate**: `-b:a 128k`

## Stream Relay Configuration

The relay configuration allows you to automatically push streams to other RTMP endpoints or to create a test stream:

```javascript
relay: {
  ffmpeg: "/opt/homebrew/bin/ffmpeg",
  tasks: [
    {
      app: "live",           // Source application
      mode: "push",          // Push mode (can be "pull" to pull from external source)
      edge: "rtmp://localhost:1935/live/test",  // Destination RTMP URL
      id: "test_stream",     // Unique identifier
      relay_audio: true,     // Relay audio
      relay_video: true,     // Relay video
    },
  ],
},
```

### Relay to External RTMP Servers

To simultaneously stream to external services like YouTube, Twitch, or Facebook:

```javascript
relay: {
  ffmpeg: "/opt/homebrew/bin/ffmpeg",
  tasks: [
    // Relay to YouTube
    {
      app: "live",
      mode: "push",
      edge: "rtmp://a.rtmp.youtube.com/live2/YOUR_YOUTUBE_KEY",
      id: "youtube_relay",
      relay_audio: true,
      relay_video: true,
    },
    // Relay to Twitch
    {
      app: "live",
      mode: "push",
      edge: "rtmp://live.twitch.tv/app/YOUR_TWITCH_KEY",
      id: "twitch_relay",
      relay_audio: true,
      relay_video: true,
    },
  ],
},
```

## Express Server Configuration

The Express server handles API requests and serves the web interface:

```javascript
// Express API Server
const app = express();

// Configure CORS
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

// Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});
```

### CORS Configuration

To restrict access to specific domains, change the CORS configuration:

```javascript
app.use(
  cors({
    origin: ["https://yourdomain.com", "https://admin.yourdomain.com"],
    credentials: true,
    // ...
  })
);
```

### Adding Authentication

To add simple API authentication:

```javascript
// Middleware for API authentication
const apiAuth = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Apply middleware to API routes
app.use("/api", apiAuth);
```

## Video Player Configuration

The video player is configured in `public/js/watch.js`:

```javascript
const playerOptions = {
  liveui: true,
  liveTracker: {
    trackingThreshold: 0.5, // How far from live before showing live button
    liveTolerance: 1, // How many seconds behind live to be considered "live"
  },
  html5: {
    vhs: {
      overrideNative: true,
      lowLatencyMode: true,
      useBandwidthFromLocalStorage: true,
      enableLowInitialPlaylist: true,
      bufferSize: 0.5, // Buffer size in seconds
    },
  },
  responsive: true,
  fluid: true,
  controls: true,
  autoplay: false,
  preload: "auto",
};
```

### Adjusting Player Latency

For lower latency at the expense of possible buffering:

```javascript
liveTracker: {
  trackingThreshold: 0.3,
  liveTolerance: 0.5,
},
html5: {
  vhs: {
    lowLatencyMode: true,
    bufferSize: 0.3,
  },
},
```

For more stable playback with higher latency:

```javascript
liveTracker: {
  trackingThreshold: 1,
  liveTolerance: 2,
},
html5: {
  vhs: {
    lowLatencyMode: false,
    bufferSize: 2,
  },
},
```

## Environment Variables

You can use environment variables to configure the application. Create a `.env` file in the root directory:

```
# Server ports
PORT=3000
RTMP_PORT=1935
HLS_PORT=8000

# FFmpeg path
FFMPEG_PATH=/usr/bin/ffmpeg

# Authentication
API_KEY=your_secret_api_key
ENABLE_AUTH=false

# Logging
LOG_LEVEL=info

# Storage
MEDIA_ROOT=./media
THUMBNAIL_DIR=./public/thumbnails
```

Then use `dotenv` to load these variables:

```javascript
require("dotenv").config();

const rtmpConfig = {
  rtmp: {
    port: process.env.RTMP_PORT || 1935,
    // ...
  },
  // ...
  trans: {
    ffmpeg: process.env.FFMPEG_PATH || "/usr/bin/ffmpeg",
    // ...
  },
};
```

## Advanced Configurations

### Enabling Recordings

To record all streams as MP4 files:

```javascript
trans: {
  ffmpeg: "/opt/homebrew/bin/ffmpeg",
  tasks: [
    {
      app: "live",
      hls: true,
      hlsFlags: "[hls_time=2:hls_list_size=5:hls_flags=delete_segments+append_list]",
      mp4: true,                    // Enable MP4 recording
      mp4Flags: "[movflags=faststart]",  // MP4 flags for web-ready files
    },
  ],
},
```

### Multi-Bitrate Streaming (Adaptive Streaming)

To create multiple bitrate versions for adaptive streaming:

```javascript
trans: {
  ffmpeg: "/opt/homebrew/bin/ffmpeg",
  tasks: [
    {
      app: "live",
      hls: true,
      hlsFlags: "[hls_time=2:hls_list_size=5:hls_flags=delete_segments+append_list+program_date_time]",
      hlsKeep: false,
      // Create variants with different qualities
      customArgs: "-c:v libx264 -vf split=3[v1][v2][v3]; \
        [v1]scale=w=640:h=360[v1out]; \
        [v2]scale=w=854:h=480[v2out]; \
        [v3]scale=w=1280:h=720[v3out]; \
        [v1out]copy[v1end]; \
        [v2out]copy[v2end]; \
        [v3out]copy[v3end] \
        -map [v1end] -c:v:0 libx264 -b:v:0 800k -maxrate:v:0 856k -bufsize:v:0 1200k \
        -map [v2end] -c:v:1 libx264 -b:v:1 1400k -maxrate:v:1 1498k -bufsize:v:1 2100k \
        -map [v3end] -c:v:2 libx264 -b:v:2 2800k -maxrate:v:2 2996k -bufsize:v:2 4200k \
        -map a:0 -c:a:0 aac -b:a:0 96k \
        -map a:0 -c:a:1 aac -b:a:1 96k \
        -map a:0 -c:a:2 aac -b:a:2 128k \
        -var_stream_map 'v:0,a:0 v:1,a:1 v:2,a:2' \
        -master_pl_name master.m3u8 \
        -f hls -hls_time 2 -hls_list_size 5 -hls_flags delete_segments+append_list+program_date_time \
        -hls_segment_filename stream_%v_%03d.ts \
        stream_%v.m3u8",
    },
  ],
},
```

### Thumbnail Generation

To automatically generate thumbnails from streams:

```javascript
tasks: [
  {
    app: 'live',
    hls: true,
    hlsFlags: '...',
    // Generate a thumbnail every 10 seconds
    screenshots: {
      folder: './public/thumbnails',
      interval: 10,       // seconds
      size: '320x180',    // thumbnail size
      filename: '#{streamName}_#{timestamp}.png',
    },
  },
],
```

### Authentication for Publishing

To require authentication for RTMP publishing:

```javascript
auth: {
  api: false,
  play: false,
  publish: true,      // Require auth for publishing
  publishUser: [
    {
      username: 'broadcaster1',
      password: 'securepassword1',
    },
    {
      username: 'broadcaster2',
      password: 'securepassword2',
    },
  ],
},
```

With this configuration, broadcasters would need to use:

```
rtmp://localhost:1935/live/streamkey?user=broadcaster1&pass=securepassword1
```
