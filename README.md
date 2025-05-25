# LiveTube - RTMP Live Streaming Platform

A YouTube-like live streaming platform using the RTMP protocol with Node.js, Express, and node-media-server.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Streaming with OBS](#streaming-with-obs)
  - [Viewing Streams](#viewing-streams)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

## Overview

LiveTube is a platform that allows users to broadcast live streams using the RTMP protocol and view them in a web browser through HLS (HTTP Live Streaming). The platform provides a YouTube-like experience with a broadcaster page and a viewer page.

## Features

- **RTMP Ingest**: Accept RTMP streams from broadcasting software like OBS
- **HLS Conversion**: Convert RTMP streams to HLS for browser playback
- **Low Latency**: Optimized for lower latency streaming (2-5 seconds)
- **Stream Management**: Create, view, and manage streams
- **View Count Tracking**: Track viewer counts for each stream
- **Responsive UI**: Mobile-friendly interface for both broadcasters and viewers
- **Auto Test Stream**: Automatically generates a test stream for debugging
- **Fallback Mechanism**: Falls back to test stream when a stream is not available

## Architecture

The system consists of three main components:

1. **RTMP Server** (Port 1935): Handles incoming RTMP streams from broadcasting software
2. **HLS Server** (Port 8000): Serves HLS streams to web browsers
3. **API Server** (Port 3000): Manages stream metadata and provides REST APIs

### Data Flow

```
Broadcaster (OBS) → RTMP Server → FFmpeg Conversion → HLS Files → Web Viewers
                                                     ↓
                                            Stream Metadata in API
```

## Installation

### Prerequisites

- Node.js (v14 or later)
- FFmpeg
- NPM or Yarn

### Step 1: Install FFmpeg

#### macOS (using Homebrew)

```bash
brew install ffmpeg
```

#### Ubuntu/Debian

```bash
apt-get install ffmpeg
```

#### Windows

Download from [FFmpeg's official website](https://ffmpeg.org/download.html)

### Step 2: Clone and Install Dependencies

```bash
git clone <repository-url>
cd LiveTube
npm install
```

### Step 3: Create Environment Variables (Optional)

Create a `.env` file in the root directory:

```
PORT=3000
FFMPEG_PATH=/path/to/ffmpeg
```

### Step 4: Start the Server

```bash
npm start
```

## Configuration

The server's configuration is defined in `index.js`. The main configuration options are:

### RTMP Server Configuration

```javascript
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
    ffmpeg: "/opt/homebrew/bin/ffmpeg", // Path to FFmpeg
    tasks: [
      {
        app: "live",
        hls: true,
        hlsFlags:
          "[hls_time=2:hls_list_size=5:hls_flags=delete_segments+append_list]",
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
```

### HLS Configuration

- **hls_time**: Duration of each segment in seconds (default: 2)
- **hls_list_size**: Number of segments to keep in the playlist (default: 5)
- **hlsFlags**: Additional FFmpeg flags for HLS generation
  - `delete_segments`: Delete old segments automatically
  - `append_list`: Append to playlist instead of overwriting

## Usage

### Streaming with OBS

1. Open OBS Studio
2. Go to Settings > Stream
3. Set Service to "Custom..."
4. Set Server to `rtmp://localhost:1935/live`
5. Set Stream Key to a unique identifier (e.g., `mystream`)
6. Click "Apply" and "OK"
7. Click "Start Streaming" in the main OBS window

### Creating a Stream via Web Interface

1. Visit `http://localhost:3000/broadcast.html` in your browser
2. Enter a stream title, description, and username
3. Click "Create Stream"
4. Use the displayed Stream Key in your broadcasting software

### Viewing Streams

1. Visit `http://localhost:3000` to see all active streams
2. Click on a stream to watch it
3. Alternatively, visit `http://localhost:3000/watch.html?key=STREAM_KEY` directly

## API Reference

### Stream Management

#### Get All Streams

```
GET /api/streams
```

#### Get a Specific Stream

```
GET /api/streams/:streamKey
```

#### Create a New Stream

```
POST /api/streams
Body: {
  "title": "Stream Title",
  "description": "Stream Description",
  "streamKey": "unique_stream_key",
  "username": "broadcaster_name"
}
```

#### Mark a Stream as Live

```
PUT /api/streams/:streamKey/live
```

#### Increment View Count

```
PUT /api/streams/:streamKey/view
```

#### End a Stream

```
DELETE /api/streams/:streamKey
```

### Test Stream Generation

#### Generate a Test Stream

```
GET /api/generate-test-stream
```

## HLS URLs

The HLS streams are available at:

```
http://localhost:8000/live/{streamKey}/index.m3u8
```

A test stream is always available at:

```
http://localhost:8000/live/test/index.m3u8
```

## Troubleshooting

### Common Issues

#### "FFmpeg not found" error

- Ensure FFmpeg is installed and the path in the configuration is correct
- Run `which ffmpeg` to find the correct path on your system

#### Stream Not Showing Up

- Check OBS settings to ensure the RTMP URL and stream key are correct
- Verify the stream appears in `GET /api/streams` response
- Check for FFmpeg errors in the server logs

#### High Latency

- Adjust the HLS settings in the RTMP configuration:
  - Reduce `hls_time` to 1-2 seconds
  - Reduce `hls_list_size` to 3-5 segments
  - Add `low_latency` flag to `hlsFlags`

#### Missing Segments or Playback Issues

- Ensure your HLS directories have proper write permissions
- Verify FFmpeg is generating segments correctly
- Check browser console for playback errors
- Use the test stream to verify the pipeline is working

### Verifying HLS Generation

To check if HLS segments are being generated:

1. Start streaming with OBS
2. Check the directory: `media/live/{streamKey}/`
3. You should see an `index.m3u8` file and several `.ts` segment files
4. If no files appear, check server logs for FFmpeg errors

### Fallback to Test Stream

The system will automatically fall back to the test stream if:

1. The requested stream is not found
2. The stream has ended
3. There are playback errors with the main stream

You can manually access the test stream at any time by visiting:

```
http://localhost:3000/watch.html?key=test
```

## Performance Considerations

- HLS segment duration affects latency and playback stability
- Shorter segments reduce latency but can cause more buffering
- The default configuration balances latency (2-5 seconds) and stability
- For production deployments, consider using a CDN for HLS delivery

## Technologies Used

- Node.js
- Express
- Node-Media-Server (RTMP server)
- Video.js (HLS player)
- HTML/CSS/JavaScript

## License

MIT
