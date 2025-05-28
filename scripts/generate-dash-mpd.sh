#!/bin/bash

# Check if a stream key was provided as an argument
if [ $# -eq 1 ]; then
  STREAM_KEY="$1"
else
  # Default stream key
  STREAM_KEY="stream"
fi

# Variables
MPD_FILE="/usr/local/srs/objs/nginx/html/live/$STREAM_KEY.mpd"

# Check if we're running in Docker or locally
if [ -d "/usr/local/srs/objs/nginx/html/live" ]; then
  # Running in Docker
  MEDIA_DIR="/usr/local/srs/objs/nginx/html/live"
else
  # Running locally
  MEDIA_DIR="./media/live"
  MPD_FILE="$MEDIA_DIR/$STREAM_KEY.mpd"
  # Create media directory if it doesn't exist
  mkdir -p $MEDIA_DIR
fi

# Create the MPD file with basic structure
cat > $MPD_FILE << EOF
<?xml version="1.0" encoding="utf-8"?>
<MPD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns="urn:mpeg:dash:schema:mpd:2011"
    xsi:schemaLocation="urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd"
    type="dynamic"
    minimumUpdatePeriod="PT10S"
    timeShiftBufferDepth="PT30S"
    availabilityStartTime="1970-01-01T00:00:00Z"
    maxSegmentDuration="PT10S"
    minBufferTime="PT10S"
    profiles="urn:mpeg:dash:profile:isoff-live:2011">
    
    <Period start="PT0S" id="1">
        <AdaptationSet id="1" mimeType="video/mp4" segmentAlignment="true" startWithSAP="1">
            <SegmentTemplate timescale="1000" media="$STREAM_KEY-\$Number\$.m4s" initialization="$STREAM_KEY-init.mp4" startNumber="1" duration="10000"/>
            <Representation id="video" width="1280" height="720" frameRate="30/1" sar="1:1" codecs="avc1.64001f" bandwidth="1500000"/>
        </AdaptationSet>
        
        <AdaptationSet id="2" mimeType="audio/mp4" segmentAlignment="true" startWithSAP="1">
            <SegmentTemplate timescale="1000" media="$STREAM_KEY-audio-\$Number\$.m4s" initialization="$STREAM_KEY-audio-init.mp4" startNumber="1" duration="10000"/>
            <Representation id="audio" codecs="mp4a.40.2" bandwidth="128000" audioSamplingRate="48000">
                <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
            </Representation>
        </AdaptationSet>
    </Period>
</MPD>
EOF

# Output message based on environment
if [ -d "/usr/local/srs/objs/nginx/html/live" ]; then
  echo "Generated DASH MPD file at $MPD_FILE for stream key: $STREAM_KEY"
else
  echo "Generated DASH MPD file at $MPD_FILE"
  echo "You can access it at http://localhost:8080/live/$STREAM_KEY.mpd" 
fi 