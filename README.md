# Live Streaming Platform

A low-latency live streaming platform built with SRS Media Server, FFmpeg, and React.

## Architecture

This project implements a scalable, low-latency live streaming architecture optimized for web browsers:

- **Ingest Protocol**: RTMP (1-2s latency)
- **Playback Protocols**:
  - DASH with Shaka Player for desktop/web (2-4s latency)
  - HLS with hls.js for iOS and fallback (2-4s latency)

## Components

1. **SRS Media Server**: Handles RTMP ingestion and HLS/DASH output
2. **Transcoding Server**: Creates multiple renditions of the stream using FFmpeg
3. **Frontend Application**: React-based web interface for streamers and viewers

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js and npm (for development)
- OBS Studio or similar software for streaming

### Installation

1. Clone the repository
2. Run the Docker Compose setup:

```bash
docker-compose up -d
```

3. Access the web interface at `http://localhost:3000`

## Usage

### For Streamers

1. Go to `http://localhost:3000/stream`
2. Get your unique stream key
3. Configure OBS Studio:
   - Set the server to `rtmp://localhost:1935/live`
   - Use the stream key from the dashboard
4. Start streaming in OBS
5. Share your unique viewer link with your audience

### For Viewers

1. Visit the link provided by the streamer: `http://localhost:3000/watch/[STREAM_KEY]`
2. Choose between HLS and DASH formats
3. Enjoy the stream with low latency

## Development

### Frontend Development

```bash
cd frontend
npm install
npm start
```

## Disabling DASH and FLV Streams

To reduce server resource usage, you can disable DASH and FLV stream generation. This optimizes the platform to use only HLS streaming, which is well-supported across modern browsers.

### Steps to Disable DASH and FLV:

1. **Update SRS Configuration**:

   - Edit `config/srs.conf`
   - Set `http_remux.enabled` to `off` to disable FLV
   - Set `dash.enabled` to `off` to disable DASH

2. **Update Transcoder**:

   - Edit `transcoder/start.sh`
   - Remove the DASH generation sections (lines that use `-f dash`)
   - Keep only the HLS-compatible RTMP outputs

3. **Restart the Services**:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

These changes have already been applied to the codebase, but these instructions are provided for reference.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- SRS Media Server team
- FFmpeg project
- Shaka Player and hls.js developers
