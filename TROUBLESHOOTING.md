# LiveTube Troubleshooting Guide

This document provides detailed solutions for common issues you might encounter when using the LiveTube streaming platform.

## Table of Contents

- [RTMP Connection Issues](#rtmp-connection-issues)
- [HLS Playback Issues](#hls-playback-issues)
- [FFmpeg Issues](#ffmpeg-issues)
- [Stream Not Visible](#stream-not-visible)
- [High Latency](#high-latency)
- [Browser Compatibility](#browser-compatibility)
- [Test Stream Generation](#test-stream-generation)
- [Common Error Messages](#common-error-messages)

## RTMP Connection Issues

### OBS Can't Connect to RTMP Server

**Symptoms:**

- OBS shows "Failed to connect to server"
- No stream appears in the API

**Possible Solutions:**

1. **Check RTMP Port Availability**

   ```bash
   # Check if port 1935 is open and listening
   netstat -an | grep 1935
   ```

2. **Verify Server is Running**

   - Ensure the Node.js server is running
   - Check console logs for any RTMP server initialization errors

3. **Check Firewall Settings**

   - Make sure port 1935 is allowed in your firewall

4. **Correct RTMP URL Format**

   - Ensure you're using the correct format: `rtmp://localhost:1935/live/[streamKey]`
   - Don't include `http://` or `https://` in the RTMP URL

5. **Verify OBS Settings**
   - Server: `rtmp://localhost:1935/live`
   - Stream Key: your unique stream key

### Stream Disconnects Frequently

**Possible Solutions:**

1. **Increase Timeout Settings**

   - Modify the `ping_timeout` in RTMP configuration (increase to 120 seconds)

2. **Check Network Stability**

   - Ensure your network connection is stable
   - Try using a wired connection instead of Wi-Fi

3. **Reduce Encoding Bitrate**
   - Lower your video bitrate in OBS (try 2500-3500 Kbps)
   - Use "Main" profile instead of "High" profile

## HLS Playback Issues

### Video Doesn't Play in Browser

**Symptoms:**

- Spinner keeps loading
- Video player shows error
- Blank/black video screen

**Possible Solutions:**

1. **Check HLS Segment Generation**

   ```bash
   # List the HLS segments for your stream
   ls -la media/live/[streamKey]/
   ```

2. **Verify HLS URL**

   - Ensure you're using the correct URL format: `http://localhost:8000/live/[streamKey]/index.m3u8`
   - Open the m3u8 file directly in the browser to check if it's accessible

3. **Clear Browser Cache**

   - Try in incognito/private browsing mode
   - Clear browser cache and cookies

4. **Test with VLC Player**

   - Open the HLS URL in VLC to check if it works outside the browser
   - In VLC: Media > Open Network Stream > paste the HLS URL

5. **Check CORS Headers**
   - Ensure the server has proper CORS headers enabled
   - Look for CORS errors in browser console

### Video Loads But Stalls Frequently

**Possible Solutions:**

1. **Adjust HLS Settings**

   ```javascript
   hlsFlags: "[hls_time=2:hls_list_size=5:hls_flags=delete_segments+append_list]";
   ```

   - Increase `hls_time` to 3-4 seconds for more stable playback
   - Increase `hls_list_size` to 8-10 for more buffer

2. **Check Network Bandwidth**

   - Ensure you have enough bandwidth for both streaming and viewing
   - Lower the streaming quality in OBS

3. **Reduce Video Resolution**

   - Try streaming at 720p instead of 1080p
   - Lower the frame rate to 30fps

4. **Check CPU Usage**
   - Ensure your server has enough CPU resources for transcoding
   - Monitor server resource usage during streaming

## FFmpeg Issues

### "FFmpeg Not Found" Error

**Solutions:**

1. **Verify FFmpeg Installation**

   ```bash
   which ffmpeg
   ffmpeg -version
   ```

2. **Set Correct FFmpeg Path**

   - Update the `ffmpeg` path in the RTMP configuration
   - For macOS with Homebrew: `/opt/homebrew/bin/ffmpeg`
   - For Linux: `/usr/bin/ffmpeg`

3. **Install FFmpeg if Missing**

   ```bash
   # macOS
   brew install ffmpeg

   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install ffmpeg

   # Windows
   # Download from ffmpeg.org and add to PATH
   ```

### Transcoding Errors

**Symptoms:**

- Server logs show FFmpeg errors
- No HLS segments are generated

**Solutions:**

1. **Check FFmpeg Log Output**

   - Look for specific error messages in the server console

2. **Verify FFmpeg Permissions**

   - Ensure FFmpeg has permission to write to the media directory

3. **Test FFmpeg Manually**

   ```bash
   ffmpeg -f lavfi -i testsrc=duration=10:size=640x360:rate=30 -f lavfi -i sine=frequency=1000:duration=10 -c:v libx264 -c:a aac -f hls -hls_time=2 -hls_list_size=5 -hls_flags delete_segments+append_list media/live/test/index.m3u8
   ```

4. **Check Disk Space**
   - Ensure you have enough disk space for video segments

## Stream Not Visible

### Stream Does Not Appear in API

**Solutions:**

1. **Check Stream Registration**

   ```bash
   # Get all streams
   curl http://localhost:3000/api/streams
   ```

2. **Register Stream Manually**

   ```bash
   curl -X POST http://localhost:3000/api/streams -H "Content-Type: application/json" -d '{"title":"Test Stream","description":"Test Description","streamKey":"test","username":"Tester"}'
   ```

3. **Verify RTMP Events**

   - Check server logs for `prePublish` and `postPublish` events
   - Ensure the stream key used in OBS matches the one registered in the API

4. **Restart the Server**
   - Sometimes a server restart can resolve registration issues

### Stream Shows as Live but No Video Appears

**Solutions:**

1. **Check HLS Segment Generation**

   - Verify that `.ts` segment files are being created in `media/live/[streamKey]/`

2. **Verify Media Directory Permissions**

   - Ensure the Node.js process has write access to the media directory

3. **Check for Codec Issues**

   - Try using different video/audio codecs in OBS
   - Recommended: H.264 video, AAC audio

4. **Use the Test Stream**
   - Try accessing the test stream to check if HLS playback works in general:
     `http://localhost:8000/live/test/index.m3u8`

## High Latency

### Stream Has More Than 10 Seconds Delay

**Solutions:**

1. **Optimize HLS Settings**

   ```javascript
   hlsFlags: "[hls_time=1:hls_list_size=3:hls_flags=delete_segments+append_list+low_latency]";
   ```

2. **Adjust Player Settings**

   ```javascript
   const playerOptions = {
     liveui: true,
     liveTracker: {
       trackingThreshold: 0.5,
       liveTolerance: 1,
     },
     html5: {
       vhs: {
         overrideNative: true,
         lowLatencyMode: true,
         useBandwidthFromLocalStorage: true,
         enableLowInitialPlaylist: true,
         bufferSize: 0.5,
       },
     },
   };
   ```

3. **Use Lower Resolution/Bitrate**

   - Streaming at lower resolutions (720p or 480p) can reduce latency
   - Use a lower bitrate (2000-3000 Kbps)

4. **Enable Low Latency Mode in OBS**
   - In OBS, go to Settings > Output > Streaming
   - Check "Enable Low Latency Mode"

## Browser Compatibility

### Video Not Playing in Specific Browsers

**Solutions:**

1. **Check Browser Support for HLS**

   - Chrome, Firefox, and Safari should all support HLS through Media Source Extensions
   - Use the VideoJS player for best cross-browser compatibility

2. **Add Additional Format Support**

   - Consider adding DASH support for browsers that prefer it
   - Ensure you're using the latest version of VideoJS

3. **Check Console Errors**

   - Open browser developer tools and check for specific errors

4. **Try Different Player Library**
   - If VideoJS isn't working well, try Shaka Player or HLS.js directly

## Test Stream Generation

### Test Stream Not Working

**Solutions:**

1. **Generate Test Stream Manually**

   ```bash
   curl http://localhost:3000/api/generate-test-stream
   ```

2. **Check Test Stream Files**

   ```bash
   ls -la media/live/test/
   ```

3. **Run FFmpeg Command Directly**

   ```bash
   ffmpeg -f lavfi -i testsrc=duration=12:size=640x360:rate=30 -f lavfi -i sine=frequency=1000:duration=12 -c:v libx264 -c:a aac -pix_fmt yuv420p -f hls -hls_time=4 -hls_playlist_type vod -hls_segment_filename "media/live/test/test%d.ts" "media/live/test/index.m3u8"
   ```

4. **Verify FFmpeg Installation**
   - Make sure your FFmpeg installation includes all necessary codecs

## Common Error Messages

### "TypeError: Cannot set property HlsHandler"

**Solution:**

- Remove the videojs-contrib-hls plugin as it conflicts with newer VideoJS versions
- Use the built-in HLS support in VideoJS version 7+

### "Failed to load resource: the server responded with a status of 404"

**Solution:**

- Check if the stream is actually live
- Verify the stream key in the URL
- Check if HLS segments have been generated
- Try the test stream as a fallback

### "Cannot GET /api/streams/[streamKey]"

**Solution:**

- Make sure you've registered the stream first via POST request
- Check if you're using the correct API endpoint
- Verify that the stream key exists in the `activeStreams` object

### "WebSocket connection failed"

**Solution:**

- If you're using WebSockets for chat or other features, check the WebSocket server status
- Ensure the correct WebSocket port is open and accessible

### "FFmpeg exited with code 1"

**Solution:**

- Check the FFmpeg command line arguments
- Look for specific error messages from FFmpeg in the logs
- Verify that the input stream format is compatible with FFmpeg

## Additional Resources

For more information and help, refer to:

- [node-media-server Documentation](https://github.com/illuspas/Node-Media-Server)
- [VideoJS Documentation](https://docs.videojs.com/)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [HLS Specification](https://developer.apple.com/streaming/)
