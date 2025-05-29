#!/bin/bash

# Test Stream ID - change this or use parameter
STREAM_ID=${1:-"test-stream-123"}

# Determine OS for appropriate test video source
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS - use testsrc with yuv420p pixel format (compatible with baseline profile)
  SOURCE_OPTS="-f lavfi -i testsrc=size=1280x720:rate=30 -pix_fmt yuv420p -f lavfi -i sine=frequency=1000:sample_rate=44100"
  echo "Using test pattern on macOS"
else
  # Linux - use testsrc with yuv420p pixel format
  SOURCE_OPTS="-f lavfi -i testsrc=size=1280x720:rate=30 -pix_fmt yuv420p -f lavfi -i sine=frequency=1000:sample_rate=44100"
  echo "Using test pattern on Linux"
fi

# Output details
echo "Streaming to RTMP URL: rtmp://localhost:1935/app/${STREAM_ID}"
echo "Stream will be available at:"
echo "- WebRTC: ws://localhost:3333/app/${STREAM_ID}"
echo "- HLS: http://localhost:8080/app/${STREAM_ID}/llhls.m3u8"
echo ""
echo "Press Ctrl+C to stop streaming"

# Run FFmpeg
# Using baseline profile for better compatibility
# Using keyframe interval of 60 frames (2 seconds at 30fps)
# Using CBR bitrate control
ffmpeg ${SOURCE_OPTS} \
  -c:v libx264 -profile:v baseline -preset veryfast -tune zerolatency \
  -g 60 -keyint_min 60 -sc_threshold 0 \
  -b:v 2500k -maxrate 2500k -bufsize 2500k \
  -c:a aac -b:a 128k -ar 44100 \
  -f flv rtmp://localhost:1935/app/${STREAM_ID} 