#!/bin/bash

# Check if a stream key was provided as an argument
if [ $# -eq 1 ]; then
  STREAM_KEY="$1"
else
  # Default stream key
  STREAM_KEY="stream"
fi

# Variables
SRS_HOST="localhost"
SRS_PORT="8080"
MPD_URL="http://${SRS_HOST}:${SRS_PORT}/live/${STREAM_KEY}.mpd"
INIT_VIDEO_URL="http://${SRS_HOST}:${SRS_PORT}/live/${STREAM_KEY}-init.mp4"
INIT_AUDIO_URL="http://${SRS_HOST}:${SRS_PORT}/live/${STREAM_KEY}-audio-init.mp4"
SEGMENT_VIDEO_URL="http://${SRS_HOST}:${SRS_PORT}/live/${STREAM_KEY}-1.m4s"
SEGMENT_AUDIO_URL="http://${SRS_HOST}:${SRS_PORT}/live/${STREAM_KEY}-audio-1.m4s"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Manual DASH Test Script${NC}"
echo "------------------------"
echo "Testing manually generated DASH files for stream: ${STREAM_KEY}"
echo "------------------------"

# Make sure our RTMP stream is running
echo -e "${YELLOW}Checking if RTMP stream is running...${NC}"
STREAM_CHECK=$(curl -s http://localhost:1985/api/v1/streams/ | grep -o "${STREAM_KEY}")

if [ -z "$STREAM_CHECK" ]; then
    echo -e "${YELLOW}Stream ${STREAM_KEY} is not active. Starting test stream...${NC}"
    docker run --rm -d --name test-stream ossrs/srs:encoder ffmpeg -stream_loop -1 -re -i /usr/local/srs/doc/source.flv -c copy -f flv rtmp://host.docker.internal/live/${STREAM_KEY}
    sleep 5
    STREAM_CHECK=$(curl -s http://localhost:1985/api/v1/streams/ | grep -o "${STREAM_KEY}")
    if [ -z "$STREAM_CHECK" ]; then
        echo -e "${RED}Failed to start stream. Please check Docker logs.${NC}"
        exit 1
    else
        echo -e "${GREEN}Stream started successfully.${NC}"
    fi
else
    echo -e "${GREEN}Stream ${STREAM_KEY} is already active.${NC}"
fi

# Generate MPD file
echo -e "${YELLOW}Generating MPD file...${NC}"
./scripts/generate-dash-mpd.sh "${STREAM_KEY}"

# Test MPD file access
echo -e "${YELLOW}Testing MPD file access...${NC}"
MPD_RESPONSE=$(curl -sI "${MPD_URL}")
MPD_STATUS=$(echo "${MPD_RESPONSE}" | grep -c "200 OK")

if [ ${MPD_STATUS} -eq 1 ]; then
    echo -e "${GREEN}MPD file is accessible at ${MPD_URL}${NC}"
    echo -e "${YELLOW}MPD file content:${NC}"
    curl -s "${MPD_URL}"
    echo ""
else
    echo -e "${RED}Failed to access MPD file at ${MPD_URL}${NC}"
    echo "Response:"
    echo "${MPD_RESPONSE}"
    exit 1
fi

# Test initialization segments
echo -e "${YELLOW}Testing video initialization segment...${NC}"
INIT_VIDEO_RESPONSE=$(curl -sI "${INIT_VIDEO_URL}")
INIT_VIDEO_STATUS=$(echo "${INIT_VIDEO_RESPONSE}" | grep -c "200 OK")

if [ ${INIT_VIDEO_STATUS} -eq 1 ]; then
    echo -e "${GREEN}Video initialization segment is accessible at ${INIT_VIDEO_URL}${NC}"
else
    echo -e "${RED}Failed to access video initialization segment at ${INIT_VIDEO_URL}${NC}"
    echo "Response:"
    echo "${INIT_VIDEO_RESPONSE}"
    exit 1
fi

echo -e "${YELLOW}Testing audio initialization segment...${NC}"
INIT_AUDIO_RESPONSE=$(curl -sI "${INIT_AUDIO_URL}")
INIT_AUDIO_STATUS=$(echo "${INIT_AUDIO_RESPONSE}" | grep -c "200 OK")

if [ ${INIT_AUDIO_STATUS} -eq 1 ]; then
    echo -e "${GREEN}Audio initialization segment is accessible at ${INIT_AUDIO_URL}${NC}"
else
    echo -e "${RED}Failed to access audio initialization segment at ${INIT_AUDIO_URL}${NC}"
    echo "Response:"
    echo "${INIT_AUDIO_RESPONSE}"
    exit 1
fi

# Test media segments
echo -e "${YELLOW}Testing video media segment...${NC}"
SEGMENT_VIDEO_RESPONSE=$(curl -sI "${SEGMENT_VIDEO_URL}")
SEGMENT_VIDEO_STATUS=$(echo "${SEGMENT_VIDEO_RESPONSE}" | grep -c "200 OK")

if [ ${SEGMENT_VIDEO_STATUS} -eq 1 ]; then
    echo -e "${GREEN}Video media segment is accessible at ${SEGMENT_VIDEO_URL}${NC}"
else
    echo -e "${RED}Failed to access video media segment at ${SEGMENT_VIDEO_URL}${NC}"
    echo "Response:"
    echo "${SEGMENT_VIDEO_RESPONSE}"
    exit 1
fi

echo -e "${YELLOW}Testing audio media segment...${NC}"
SEGMENT_AUDIO_RESPONSE=$(curl -sI "${SEGMENT_AUDIO_URL}")
SEGMENT_AUDIO_STATUS=$(echo "${SEGMENT_AUDIO_RESPONSE}" | grep -c "200 OK")

if [ ${SEGMENT_AUDIO_STATUS} -eq 1 ]; then
    echo -e "${GREEN}Audio media segment is accessible at ${SEGMENT_AUDIO_URL}${NC}"
else
    echo -e "${RED}Failed to access audio media segment at ${SEGMENT_AUDIO_URL}${NC}"
    echo "Response:"
    echo "${SEGMENT_AUDIO_RESPONSE}"
    exit 1
fi

# Open DASH test page
echo -e "${YELLOW}Opening DASH test page...${NC}"
open http://localhost:8080/test-dash.html

echo -e "${GREEN}All tests passed! DASH files are accessible.${NC}"
echo -e "${YELLOW}Please click 'Load DASH Stream' on the test page to play the stream.${NC}"
echo -e "${YELLOW}Note: Since we're using empty placeholder files, no actual video will play, but the player should load the manifest successfully.${NC}"
echo -e "${YELLOW}You can also test the main application at: http://localhost:3000/viewer/${STREAM_KEY}${NC}"

exit 0 