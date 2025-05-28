# MPEG-DASH Implementation for Live Streaming Project

This document provides information about the MPEG-DASH implementation in the Live Streaming Project.

## Overview

MPEG-DASH (Dynamic Adaptive Streaming over HTTP) is an adaptive bitrate streaming technique that enables high quality streaming of media content over the Internet delivered from conventional HTTP web servers.

We've implemented DASH streaming using SRS (Simple RTMP Server) version 5.0.213.

## Implementation Details

Our DASH implementation consists of:

1. SRS server configuration for DASH
2. Manual MPD file generation
3. Placeholder segment files for testing
4. DASH player using dash.js library
5. Integration with the frontend React application

## Known Issues and Workarounds

The DASH implementation in SRS 5.0.213 has some known issues:

1. MPD file generation: Sometimes SRS doesn't correctly generate MPD files
2. Path issues: The MPD file may contain incorrect paths like "live/live/" instead of "live/"
3. Missing segment files: Some required segment files might not be generated

We've implemented the following workarounds:

1. Manual MPD file generation using the `generate-dash-mpd.sh` script
2. Placeholder segment files created using the `create-dash-placeholders.sh` script
3. Custom test page for verifying DASH functionality

## Test Scripts

### 1. Generate DASH MPD File

```bash
./scripts/generate-dash-mpd.sh
```

This script creates a valid MPD file with the correct structure for DASH streaming.

### 2. Create DASH Placeholders

```bash
./scripts/create-dash-placeholders.sh
```

This script creates placeholder initialization and segment files required for DASH playback.

### 3. Test Manual DASH Setup

```bash
./scripts/test-manual-dash.sh
```

This script checks if all required DASH files are accessible and opens the test page.

### 4. Check DASH URLs

```bash
./scripts/check-dash-urls.sh
```

This script verifies that all DASH-related URLs are accessible.

## Test Page

A comprehensive DASH test page is available at:

```
http://localhost:8080/test-dash.html
```

This page allows you to:

- Load and play DASH streams
- Check stream information
- Troubleshoot any issues with DASH playback

## Future Improvements

For production use, consider the following improvements:

1. Upgrade to a newer version of SRS with better DASH support
2. Use a dedicated DASH packager like Shaka Packager
3. Implement server-side DASH segment generation
4. Add better error handling and fallback mechanisms

## Alternative Streaming Methods

If DASH streaming is problematic, consider using:

1. HTTP-FLV streaming (already implemented)
2. HLS (HTTP Live Streaming)
3. WebRTC (for ultra-low latency)

Each method has its own advantages and trade-offs in terms of latency, browser compatibility, and implementation complexity.
