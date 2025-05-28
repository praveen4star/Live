#!/bin/bash

# This script tests streaming using ffmpeg
# You can use this to simulate a broadcaster without using OBS

echo "Streaming test pattern to SRS server..."
ffmpeg -re -f lavfi -i testsrc=size=1920x1080:rate=30 \
  -f lavfi -i sine=frequency=1000:sample_rate=44100 \
  -c:v libx264 -pix_fmt yuv420p -preset ultrafast -tune zerolatency -b:v 6000k \
  -c:a aac -b:a 128k \
  -f flv rtmp://localhost:1935/live/stream 