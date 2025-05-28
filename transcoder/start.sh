#!/bin/bash

echo "Waiting for SRS server to be ready..."
# Retry with exponential backoff
for i in 1 2 4 8 16; do
  if curl -s http://srs:1985/api/v1/versions > /dev/null; then
    echo "SRS server is ready"
    break
  fi
  echo "SRS not ready yet, waiting ${i}s..."
  sleep $i
done

echo "Starting transcoding..."

# Create media directory for the streams
mkdir -p /usr/local/srs/objs/nginx/html/live

# Function to monitor and process streams
monitor_and_process_streams() {
  local previous_streams=()
  
  while true; do
    # Get current list of streams
    current_streams=($(curl -s http://srs:1985/api/v1/streams/ | grep -o '"name":"[^"]*"' | sed 's/"name":"//g' | sed 's/"//g'))
    
    # Check for new streams
    for stream_key in "${current_streams[@]}"; do
      # Skip streams that already have quality suffixes (_360p, _480p, _720p)
      if [[ "$stream_key" =~ _[0-9]+p ]]; then
        echo "Skipping already transcoded stream: $stream_key"
        continue
      fi
      
      if [[ ! " ${previous_streams[@]} " =~ " ${stream_key} " ]]; then
        echo "New stream detected: $stream_key. Starting transcoding..."
        process_stream "$stream_key" &
      fi
    done
    
    # Update previous streams list
    previous_streams=("${current_streams[@]}")
    
    # Sleep before checking again
    sleep 5
  done
}

# Function to process a single stream
process_stream() {
  local stream_key=$1
  
  echo "Processing stream: $stream_key"
  
  # Generate only HLS-friendly outputs - this lets SRS handle the HLS creation
  # We're only creating RTMP streams of different quality that SRS will automatically
  # convert to HLS using its built-in capabilities
  echo "Generating multiple qualities for HLS..."
  ffmpeg -i rtmp://srs:1935/live/$stream_key \
    -c:v libx264 -b:v 3000k -s 1280x720 -preset veryfast -g 60 -c:a aac -ar 44100 -f flv rtmp://srs:1935/live/${stream_key}_720p \
    -c:v libx264 -b:v 1500k -s 854x480 -preset veryfast -g 60 -c:a aac -ar 44100 -f flv rtmp://srs:1935/live/${stream_key}_480p \
    -c:v libx264 -b:v 800k -s 640x360 -preset veryfast -g 60 -c:a aac -ar 44100 -f flv rtmp://srs:1935/live/${stream_key}_360p
}

# Start monitoring streams
monitor_and_process_streams 