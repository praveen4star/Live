#!/bin/bash

# Variables
STREAM_KEY="stream"
MEDIA_DIR="./media/live"

# Create media directory if it doesn't exist
mkdir -p $MEDIA_DIR

# Create placeholder initialization segments
echo "Creating placeholder initialization segments..."
dd if=/dev/zero of="$MEDIA_DIR/$STREAM_KEY-init.mp4" bs=1024 count=10
dd if=/dev/zero of="$MEDIA_DIR/$STREAM_KEY-audio-init.mp4" bs=1024 count=10

# Create placeholder media segments
echo "Creating placeholder media segments..."
for i in {1..5}; do
    dd if=/dev/zero of="$MEDIA_DIR/$STREAM_KEY-$i.m4s" bs=1024 count=20
    dd if=/dev/zero of="$MEDIA_DIR/$STREAM_KEY-audio-$i.m4s" bs=1024 count=20
    echo "Created segment $i"
done

echo "All placeholder files created in $MEDIA_DIR"
ls -la $MEDIA_DIR 