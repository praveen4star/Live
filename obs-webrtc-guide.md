# OBS WebRTC Audio Configuration Guide

## Quick Setup Checklist

### 1. OBS Audio Settings

- [ ] Sample Rate: 48000 Hz
- [ ] Channels: Stereo
- [ ] Audio Bitrate: 128 Kbps
- [ ] Audio Codec: AAC

### 2. Stream Settings

- [ ] Service: Custom
- [ ] Server: rtmp://localhost:1935/app
- [ ] Stream Key: your-stream-id

### 3. Test Audio Sources

Add one or more of these audio sources to verify audio is working:

#### A. Media Source (Audio File)

1. Add Source → Media Source
2. Browse to any audio file (MP3, WAV, etc.)
3. Check "Loop" if you want it to repeat
4. Volume should show activity in Audio Mixer

#### B. Audio Input Capture (Microphone)

1. Add Source → Audio Input Capture
2. Select your microphone
3. Speak into microphone - should see audio levels

#### C. Audio Output Capture (System Audio)

1. Add Source → Audio Output Capture
2. Select your system audio device
3. Play music/video - should see audio levels

### 4. Troubleshooting Steps

#### If No Audio in WebRTC but Audio Works in HLS:

1. **Check OBS Audio Levels**

   - Ensure audio sources show green bars in Audio Mixer
   - Audio levels should be between -12dB and -6dB (green/yellow)

2. **Verify Stream is Actually Sending Audio**

   - Check if RTMP stream includes audio: `ffprobe rtmp://localhost:1935/app/your-stream-id`

3. **Test with Simple Audio Source**

   - Add a Media Source with a simple audio file
   - Remove all other audio sources temporarily
   - Test if this single source works in WebRTC

4. **Check Browser Console**
   - Open browser developer tools
   - Look for WebRTC-related errors
   - Check if audio tracks are being received

#### Common Issues and Solutions:

**Issue**: Audio shows in OBS but not in WebRTC

- **Solution**: Check server logs for audio codec mismatches
- **Command**: `docker-compose logs origin-server | grep -i audio`

**Issue**: Audio is choppy or delayed

- **Solution**:
  - Reduce OBS audio buffer size
  - Check network bandwidth
  - Verify Sample Rate is 48000 Hz

**Issue**: Audio works sometimes but not others

- **Solution**:
  - Restart OBS completely
  - Check if multiple audio sources are conflicting
  - Verify audio device isn't being used by another app

### 5. Testing Commands

#### Test Stream with FFprobe

```bash
# Check if stream has audio track
ffprobe rtmp://localhost:1935/app/your-stream-id

# Check audio codec and sample rate
ffprobe -v quiet -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels rtmp://localhost:1935/app/your-stream-id
```

#### Test WebRTC Connection

```bash
# Check WebRTC endpoint
curl -s "http://localhost:3333/app/your-stream-id"
```

### 6. Optimal OBS Scene Setup for Audio Testing

**Scene Name**: "Audio Test"

**Sources**:

1. **Color Source** (background)
2. **Text Source**: "Audio Test Stream - [Current Time]"
3. **Audio Input Capture**: Your microphone
4. **Media Source**: Test audio file (sine wave or music)

**Audio Mixer Should Show**:

- Desktop Audio (if capturing system audio)
- Microphone (if using mic)
- Media Source audio

### 7. WebRTC Playback URLs

After starting your stream in OBS:

- **WebRTC**: `ws://localhost:3333/app/your-stream-id`
- **HLS**: `http://localhost:8080/app/your-stream-id/llhls.m3u8`

### 8. Advanced Troubleshooting

If audio still doesn't work:

1. **Check OME Configuration**

   ```bash
   # Check if WebRTC publisher is configured correctly
   docker-compose exec origin-server cat /opt/ovenmediaengine/bin/origin_conf/Server.xml | grep -A 10 -B 10 WebRTC
   ```

2. **Monitor WebRTC Logs**

   ```bash
   # Watch origin server logs in real-time
   docker-compose logs -f origin-server
   ```

3. **Test Different Audio Codecs**

   - Try changing OBS audio codec to different options
   - Test with different sample rates (44.1kHz vs 48kHz)

4. **Browser-Specific Issues**
   - Test in different browsers (Chrome, Firefox, Safari)
   - Check if browser has audio permissions
   - Verify browser isn't muted

### 9. Expected Behavior

When everything is working correctly:

- OBS Audio Mixer shows green bars when audio is playing
- Browser WebRTC player receives both video and audio tracks
- No audio-related errors in browser console
- Audio plays synchronously with video

### 10. Quick Test Procedure

1. Start OBS with proper settings
2. Add a Media Source with an audio file
3. Start streaming to `rtmp://localhost:1935/app/test-stream`
4. Open browser and connect to WebRTC: `ws://localhost:3333/app/test-stream`
5. Should hear audio and see video

---

**Note**: If you continue to have issues, please share:

- Your OBS log file
- Browser console errors
- Output of `docker-compose logs origin-server`
