#!/bin/bash

# Variables
STREAM_KEY="0d6382e128904909"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Make sure scripts directory exists
mkdir -p scripts

# Make sure test scripts are executable
chmod +x scripts/test-dash.sh

# Create scripts directory if it doesn't exist
if [ ! -d "scripts" ]; then
    mkdir -p scripts
fi

echo -e "${YELLOW}DASH Test Runner${NC}"
echo "------------------------"

# Check if test stream is already running
RUNNING_CONTAINER=$(docker ps -q --filter name=test-stream)
if [ -n "$RUNNING_CONTAINER" ]; then
    echo -e "${YELLOW}Test stream is already running. Stopping it first...${NC}"
    docker stop test-stream
    sleep 3
fi

# Start the test stream
echo -e "${YELLOW}Starting test stream with key: ${STREAM_KEY}${NC}"
docker run --rm -d --name test-stream ossrs/srs:encoder ffmpeg -stream_loop -1 -re -i /usr/local/srs/doc/source.flv -c copy -f flv rtmp://host.docker.internal/live/${STREAM_KEY}

# Wait for stream to initialize
echo -e "${YELLOW}Waiting for stream to initialize...${NC}"
sleep 5

# Check if stream is active
STREAM_CHECK=$(curl -s http://localhost:1985/api/v1/streams/ | grep -o "${STREAM_KEY}")
if [ -z "$STREAM_CHECK" ]; then
    echo -e "${RED}Failed to start stream. Please check the container logs:${NC}"
    docker logs test-stream
    exit 1
else
    echo -e "${GREEN}Stream started successfully.${NC}"
fi

# Run the DASH test script
echo -e "${YELLOW}Running DASH test script...${NC}"
./scripts/test-dash.sh

# Store the test result
TEST_RESULT=$?

# Clean up after test
echo -e "${YELLOW}Cleaning up...${NC}"
docker stop test-stream

if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}DASH test completed successfully.${NC}"
else
    echo -e "${RED}DASH test failed.${NC}"
fi

# Return the test result
exit $TEST_RESULT 