#!/bin/bash

# Test Stream ID - change this or use parameter
STREAM_ID=${1:-"webrtc-test-stream"}

echo "Using WebRTC-optimized test pattern"
echo "Streaming to RTMP URL: rtmp://localhost:1935/app/${STREAM_ID}"
echo "Stream will be available at:"
echo "- WebRTC: ws://localhost:3333/app/${STREAM_ID}"
echo "- HLS: http://localhost:8080/app/${STREAM_ID}/llhls.m3u8"
echo ""
echo "Press Ctrl+C to stop streaming"

# Run FFmpeg with WebRTC-optimized settings
# Properly formatted command with correct syntax for lavfi inputs
ffmpeg -f lavfi -i "testsrc=size=1280x720:rate=30" \
       -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
       -c:v libx264 -profile:v baseline -level:v 3.1 \
       -pix_fmt yuv420p \
       -preset ultrafast -tune zerolatency \
       -g 30 -keyint_min 30 -sc_threshold 0 \
       -b:v 2500k -maxrate 2500k -bufsize 2500k \
       -c:a aac -b:a 128k -ar 48000 -ac 2 \
       -vf "drawtext=text='WebRTC Test %{localtime}':x=40:y=40:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.5" \
       -f flv rtmp://localhost:1935/app/${STREAM_ID} 