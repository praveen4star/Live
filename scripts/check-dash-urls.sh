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
TEST_PAGE_URL="http://${SRS_HOST}:${SRS_PORT}/test-dash.html"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_url() {
    local url=$1
    local desc=$2
    echo -e "${YELLOW}Checking ${desc} at ${url}...${NC}"
    
    local response=$(curl -sI "${url}")
    local status=$(echo "${response}" | grep -c "200 OK")
    
    if [ ${status} -eq 1 ]; then
        echo -e "${GREEN}✓ ${desc} is accessible${NC}"
        return 0
    else
        echo -e "${RED}✗ ${desc} is NOT accessible${NC}"
        echo "Response:"
        echo "${response}"
        return 1
    fi
}

echo -e "${YELLOW}DASH URL Check Script${NC}"
echo "------------------------"
echo "Testing DASH URLs for stream: ${STREAM_KEY}"
echo "------------------------"

# Check all DASH URLs
check_url "${MPD_URL}" "MPD file"
check_url "${INIT_VIDEO_URL}" "Video initialization segment"
check_url "${INIT_AUDIO_URL}" "Audio initialization segment"
check_url "${SEGMENT_VIDEO_URL}" "Video media segment"
check_url "${SEGMENT_AUDIO_URL}" "Audio media segment"
check_url "${TEST_PAGE_URL}" "DASH test page"

echo -e "${YELLOW}All URL checks completed${NC}"
echo "You can access the test page at: ${TEST_PAGE_URL}"
echo "You can access the MPD file at: ${MPD_URL}" 