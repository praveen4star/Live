#!/bin/bash

# Set variables
STREAM_KEY="0d6382e128904909"
SRS_CONTAINER="live-v2-srs-1"
MAX_WAIT_TIME=120  # Max time to wait in seconds (increased for better testing)
HTML_PATH="/usr/local/srs/objs/nginx/html"
MPD_PATH="${HTML_PATH}/live/${STREAM_KEY}.mpd"
DASH_PATH="${HTML_PATH}/live"
CHECK_INTERVAL=5  # Time between checks in seconds (increased for better stability)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}DASH Test Script${NC}"
echo "------------------------"
echo "Testing DASH file generation for stream: ${STREAM_KEY}"
echo "------------------------"

# Check if stream is active
echo -e "${YELLOW}Checking if stream is active...${NC}"
STREAM_CHECK=$(curl -s http://localhost:1985/api/v1/streams/ | grep -o "${STREAM_KEY}")

if [ -z "$STREAM_CHECK" ]; then
    echo -e "${RED}Stream ${STREAM_KEY} is not active. Please start the stream first.${NC}"
    echo "Run: docker run --rm -d --name test-stream ossrs/srs:encoder ffmpeg -stream_loop -1 -re -i /usr/local/srs/doc/source.flv -c copy -f flv rtmp://host.docker.internal/live/${STREAM_KEY}"
    exit 1
else
    echo -e "${GREEN}Stream ${STREAM_KEY} is active. Proceeding with test.${NC}"
fi

# Create a function to check MPD file
check_mpd_file() {
    if docker exec ${SRS_CONTAINER} test -f ${MPD_PATH}; then
        echo -e "${GREEN}MPD file found at ${MPD_PATH}${NC}"
        
        # Get file size
        MPD_SIZE=$(docker exec ${SRS_CONTAINER} stat -c %s ${MPD_PATH})
        echo "MPD file size: ${MPD_SIZE} bytes"
        
        # Check if file is not empty
        if [ "$MPD_SIZE" -gt 100 ]; then
            echo -e "${GREEN}MPD file has content (${MPD_SIZE} bytes)${NC}"
            
            # Show the file content
            echo -e "${YELLOW}MPD file content:${NC}"
            docker exec ${SRS_CONTAINER} cat ${MPD_PATH}
            
            # Check for essential MPD elements
            MPD_VALID=$(docker exec ${SRS_CONTAINER} cat ${MPD_PATH} | grep -c "<MPD")
            PERIOD_VALID=$(docker exec ${SRS_CONTAINER} cat ${MPD_PATH} | grep -c "<Period")
            ADAPTATION_VALID=$(docker exec ${SRS_CONTAINER} cat ${MPD_PATH} | grep -c "<AdaptationSet")
            
            if [ "$MPD_VALID" -gt 0 ] && [ "$PERIOD_VALID" -gt 0 ] && [ "$ADAPTATION_VALID" -gt 0 ]; then
                echo -e "${GREEN}MPD file appears to be valid.${NC}"
                return 0
            else
                echo -e "${RED}MPD file may be malformed. Missing essential elements.${NC}"
                return 1
            fi
        else
            echo -e "${RED}MPD file is too small or empty.${NC}"
            return 1
        fi
    else
        echo -e "${RED}MPD file not found at ${MPD_PATH}${NC}"
        return 1
    fi
}

# Check for DASH segment files
check_dash_segments() {
    echo -e "${YELLOW}Checking for DASH segment files...${NC}"
    
    # Check for timestamp-based segments (.m4s files)
    SEGMENTS_M4S=$(docker exec ${SRS_CONTAINER} find ${DASH_PATH} -name "${STREAM_KEY}*.m4s" | wc -l)
    
    # Check for number-based segments (.mp4 segment files, not init)
    SEGMENTS_MP4=$(docker exec ${SRS_CONTAINER} find ${DASH_PATH} -name "${STREAM_KEY}*-[0-9]*.mp4" 2>/dev/null | wc -l)
    
    # Check for init segments
    INIT_SEGMENTS=$(docker exec ${SRS_CONTAINER} find ${DASH_PATH} -name "${STREAM_KEY}*init.mp4" -o -name "init-${STREAM_KEY}*.mp4" -o -name "${STREAM_KEY}*-init.mp4" 2>/dev/null | wc -l)
    
    if [ "$SEGMENTS_M4S" -gt 0 ] || [ "$SEGMENTS_MP4" -gt 0 ] || [ "$INIT_SEGMENTS" -gt 0 ]; then
        echo -e "${GREEN}Found DASH segments: ${SEGMENTS_M4S} m4s files, ${SEGMENTS_MP4} mp4 files, ${INIT_SEGMENTS} init files${NC}"
        
        # List segment files
        echo -e "${YELLOW}DASH segment files:${NC}"
        docker exec ${SRS_CONTAINER} find ${DASH_PATH} \
            \( -name "${STREAM_KEY}*.m4s" -o -name "${STREAM_KEY}*-[0-9]*.mp4" -o -name "${STREAM_KEY}*init.mp4" -o -name "init-${STREAM_KEY}*.mp4" -o -name "${STREAM_KEY}*-init.mp4" \) \
            2>/dev/null | sort
        return 0
    else
        echo -e "${RED}No DASH segment files found for stream ${STREAM_KEY}${NC}"
        
        # Check all files in the directory for debugging
        echo -e "${YELLOW}All files in ${DASH_PATH}:${NC}"
        docker exec ${SRS_CONTAINER} find ${DASH_PATH} -type f | sort
        
        return 1
    fi
}

# Monitor file generation
echo -e "${YELLOW}Monitoring DASH file generation...${NC}"
echo "Will check every ${CHECK_INTERVAL} seconds for up to ${MAX_WAIT_TIME} seconds."

ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT_TIME ]; do
    echo -e "${YELLOW}Checking for DASH files (elapsed: ${ELAPSED}s)...${NC}"
    
    # Check current files in live directory
    echo "Current files in live directory:"
    docker exec ${SRS_CONTAINER} ls -la ${DASH_PATH} | grep -i "${STREAM_KEY}" || echo "No files for ${STREAM_KEY} found"
    
    # Check for MPD file
    check_mpd_file
    MPD_RESULT=$?
    
    # Check for segment files
    check_dash_segments
    SEGMENT_RESULT=$?
    
    # If MPD file exists, that's a good start
    if [ $MPD_RESULT -eq 0 ]; then
        echo -e "${GREEN}MPD file exists - let's test if it's accessible via HTTP${NC}"
        
        # Test HTTP access
        echo -e "${YELLOW}Testing HTTP access to MPD file...${NC}"
        HTTP_TEST=$(curl -sI http://localhost:8080/live/${STREAM_KEY}.mpd | grep "200 OK")
        
        if [ -n "$HTTP_TEST" ]; then
            echo -e "${GREEN}MPD file is accessible via HTTP at http://localhost:8080/live/${STREAM_KEY}.mpd${NC}"
            echo -e "${GREEN}DASH files are being generated!${NC}"
            
            # Try to get the MPD file content via HTTP
            echo -e "${YELLOW}MPD file content via HTTP:${NC}"
            curl -s http://localhost:8080/live/${STREAM_KEY}.mpd | head -n 20
            
            exit 0
        else
            echo -e "${RED}MPD file is not accessible via HTTP. Response:${NC}"
            curl -sI http://localhost:8080/live/${STREAM_KEY}.mpd
        fi
    fi
    
    ELAPSED=$((ELAPSED + CHECK_INTERVAL))
    if [ $ELAPSED -lt $MAX_WAIT_TIME ]; then
        echo "Waiting ${CHECK_INTERVAL} seconds before next check..."
        sleep $CHECK_INTERVAL
    fi
done

echo -e "${RED}Timeout reached. DASH files were not properly generated within ${MAX_WAIT_TIME} seconds.${NC}"

# Final diagnostics
echo -e "${YELLOW}Running final diagnostics...${NC}"

# Check SRS logs for DASH-related messages
echo -e "${YELLOW}Checking SRS logs for DASH-related messages:${NC}"
docker logs ${SRS_CONTAINER} | grep -i "dash" | tail -20

# Check SRS configuration
echo -e "${YELLOW}Checking SRS configuration:${NC}"
docker exec ${SRS_CONTAINER} cat /usr/local/srs/conf/srs.conf | grep -A 20 "dash"

# List all files in the live directory
echo -e "${YELLOW}Files in live directory:${NC}"
docker exec ${SRS_CONTAINER} ls -la ${DASH_PATH}

# List other folders that might contain DASH files
echo -e "${YELLOW}Checking other possible DASH file locations:${NC}"
docker exec ${SRS_CONTAINER} find ${HTML_PATH} -type d | sort

echo -e "${YELLOW}Test completed with errors.${NC}"
exit 1 