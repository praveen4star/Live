#!/bin/bash

# Variables
STREAM_KEY="stream"
SRS_HOST="localhost"
SRS_PORT="8080"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}HTTP-FLV Test Script${NC}"
echo "------------------------"
echo "Testing HTTP-FLV for stream: ${STREAM_KEY}"
echo "------------------------"

# Check if stream is active first
echo "Checking if stream is active..."
STREAM_INFO=$(curl -s http://${SRS_HOST}:1985/api/v1/streams/)
if [[ $STREAM_INFO == *"${STREAM_KEY}"* ]]; then
    echo -e "${GREEN}Stream ${STREAM_KEY} is active. Proceeding with test.${NC}"
else
    echo -e "${RED}Stream ${STREAM_KEY} is not active. Please start the stream first.${NC}"
    echo "Run: docker run --rm -d --name test-stream ossrs/srs:encoder ffmpeg -stream_loop -1 -re -i /usr/local/srs/doc/source.flv -c copy -f flv rtmp://host.docker.internal/live/${STREAM_KEY}"
    exit 1
fi

# Test HTTP-FLV URL
FLV_URL="http://${SRS_HOST}:${SRS_PORT}/live/${STREAM_KEY}.flv"
echo "Testing HTTP-FLV URL: ${FLV_URL}"

# Check if the FLV URL is accessible
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${FLV_URL}" -m 2)

if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}HTTP-FLV URL is accessible. Status code: ${HTTP_CODE}${NC}"
    echo "You can play this stream using:"
    echo "1. VLC: ${FLV_URL}"
    echo "2. ffplay: ffplay ${FLV_URL}"
    echo "3. Web player with flv.js"
    echo -e "${GREEN}HTTP-FLV test successful!${NC}"
    exit 0
else
    echo -e "${RED}Failed to access HTTP-FLV URL. Status code: ${HTTP_CODE}${NC}"
    echo "Please check your SRS configuration and ensure the stream is active."
    exit 1
fi 