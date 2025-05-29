#!/bin/bash

# Test Stream ID - change this or use parameter
STREAM_ID=${1:-"test-stream-123"}

echo "Using simple test pattern - color bars"
echo "Streaming to RTMP URL: rtmp://localhost:1935/app/${STREAM_ID}"
echo ""
echo "Press Ctrl+C to stop streaming"

# Run FFmpeg with a simpler test source and explicit yuv420p format
ffmpeg -f lavfi -i "color=c=blue:s=1280x720:r=30,format=yuv420p" \
       -f lavfi -i "sine=frequency=1000:sample_rate=44100" \
       -c:v libx264 -profile:v main -preset ultrafast \
       -g 30 -keyint_min 30 \
       -b:v 2000k -maxrate 2000k -bufsize 2000k \
       -c:a aac -b:a 128k -ar 44100 \
       -f flv rtmp://localhost:1935/app/${STREAM_ID}