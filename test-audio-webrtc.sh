#!/bin/bash

# Test Stream ID - change this or use parameter
STREAM_ID=${1:-"audio-test-stream"}

echo "Testing WebRTC Audio-focused stream"
echo "Streaming to RTMP URL: rtmp://localhost:1935/app/${STREAM_ID}"
echo "Stream will be available at:"
echo "- WebRTC: ws://localhost:3333/app/${STREAM_ID}"
echo "- HLS: http://localhost:8080/app/${STREAM_ID}/llhls.m3u8"
echo ""
echo "This stream uses multiple audio tones for testing"
echo "Press Ctrl+C to stop streaming"

# Run FFmpeg with audio-focused testing
# Using multiple audio tones to ensure audio is working
ffmpeg -f lavfi -i "testsrc=size=1280x720:rate=30" \
       -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=0" \
       -f lavfi -i "sine=frequency=880:sample_rate=48000:duration=0" \
       -filter_complex "[1:a][2:a]amix=inputs=2:duration=longest:dropout_transition=2[audio_out]" \
       -map 0:v -map "[audio_out]" \
       -c:v libx264 -profile:v baseline -level:v 3.1 \
       -pix_fmt yuv420p \
       -preset ultrafast -tune zerolatency \
       -g 30 -keyint_min 30 -sc_threshold 0 \
       -b:v 1500k -maxrate 1500k -bufsize 1500k \
       -c:a aac -b:a 128k -ar 48000 -ac 2 \
       -af "volume=0.3" \
       -vf "drawtext=text='AUDIO TEST - Listen for dual tones':x=40:y=40:fontsize=24:fontcolor=yellow:box=1:boxcolor=black@0.7" \
       -f flv rtmp://localhost:1935/app/${STREAM_ID} 