#!/bin/bash

STREAM_ID=${1:-"obs-test-stream"}

echo "=========================================="
echo "WebRTC Complete Test - Origin & Edge"
echo "=========================================="
echo "Stream ID: $STREAM_ID"
echo ""

echo "🔴 Starting test stream..."
echo "This will create a test stream with audio and video for WebRTC testing"
echo ""

# Create a test stream with clear audio and video markers
ffmpeg -f lavfi -i "testsrc=size=1280x720:rate=30:duration=0" \
       -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=0" \
       -filter_complex "
         [0:v]drawtext=text='WebRTC Test Stream':x=50:y=50:fontsize=48:fontcolor=white:box=1:boxcolor=red@0.8,
               drawtext=text='%{localtime}':x=50:y=150:fontsize=32:fontcolor=yellow:box=1:boxcolor=black@0.8,
               drawtext=text='Listen for 440Hz tone':x=50:y=250:fontsize=24:fontcolor=green:box=1:boxcolor=black@0.8[video_out];
         [1:a]volume=0.3[audio_out]
       " \
       -map "[video_out]" -map "[audio_out]" \
       -c:v libx264 -profile:v baseline -preset faster -tune zerolatency \
       -g 30 -keyint_min 30 -sc_threshold 0 \
       -b:v 2000k -maxrate 2000k -bufsize 2000k \
       -c:a aac -b:a 128k -ar 48000 -ac 2 \
       -f flv rtmp://localhost:1935/app/${STREAM_ID} &

# Store the PID of the background process
FFMPEG_PID=$!

echo "FFmpeg PID: $FFMPEG_PID"
echo ""

# Wait for stream to start
echo "⏳ Waiting 10 seconds for stream to start..."
sleep 10

echo ""
echo "🎯 Testing Stream Availability..."
echo ""

# Test Origin Server
echo "Testing Origin Server (HLS):"
if curl -s "http://localhost:8080/app/${STREAM_ID}/llhls.m3u8" | grep -q "EXTM3U"; then
    echo "✅ Origin HLS: WORKING"
else
    echo "❌ Origin HLS: NOT WORKING"
fi

# Test Edge Server 1
echo "Testing Edge Server 1 (HLS):"
if curl -s "http://localhost:8090/app/${STREAM_ID}/llhls.m3u8" | grep -q "EXTM3U"; then
    echo "✅ Edge 1 HLS: WORKING"
else
    echo "❌ Edge 1 HLS: NOT WORKING"
fi

# Test Edge Server 2
echo "Testing Edge Server 2 (HLS):"
if curl -s "http://localhost:8091/app/${STREAM_ID}/llhls.m3u8" | grep -q "EXTM3U"; then
    echo "✅ Edge 2 HLS: WORKING"
else
    echo "❌ Edge 2 HLS: NOT WORKING"
fi

echo ""
echo "🌐 WebRTC Testing URLs:"
echo "===================="
echo "Origin Server WebRTC:  ws://localhost:3333/app/${STREAM_ID}"
echo "Edge Server 1 WebRTC:  ws://localhost:3343/app/${STREAM_ID}"
echo "Edge Server 2 WebRTC:  ws://localhost:3353/app/${STREAM_ID}"
echo ""

echo "🎮 Frontend URLs:"
echo "================="
echo "Main Frontend: http://localhost:3000"
echo "Use Stream ID: ${STREAM_ID}"
echo ""

echo "🧪 Manual Testing Instructions:"
echo "==============================="
echo "1. Open http://localhost:3000 in your browser"
echo "2. Enter Stream ID: ${STREAM_ID}"
echo "3. Test each server/protocol combination:"
echo "   - Origin + WebRTC (should have video AND audio)"
echo "   - Edge 1 + WebRTC (should have video AND audio)"
echo "   - Edge 2 + WebRTC (should have video AND audio)"
echo "   - Origin + HLS (should have video AND audio)"
echo "   - Edge 1 + HLS (should have video AND audio)"
echo "   - Edge 2 + HLS (should have video AND audio)"
echo ""

echo "🎵 Audio Test:"
echo "============="
echo "You should hear a 440Hz tone (musical note A4)"
echo "If you don't hear audio, check:"
echo "- Browser audio is not muted"
echo "- System audio is not muted"
echo "- Browser developer console for errors"
echo ""

echo "🔧 For OBS Testing:"
echo "==================="
echo "1. Configure OBS with these settings:"
echo "   - Server: rtmp://localhost:1935/app"
echo "   - Stream Key: ${STREAM_ID}"
echo "   - Audio Bitrate: 128 kbps"
echo "   - Audio Sample Rate: 48000 Hz"
echo "   - Audio Codec: AAC"
echo "2. Start streaming in OBS"
echo "3. Test WebRTC playback on all servers"
echo ""

echo "⚠️  Current test stream is running in background (PID: $FFMPEG_PID)"
echo "To stop the test stream, run: kill $FFMPEG_PID"
echo ""

echo "📋 Expected Results:"
echo "==================="
echo "✅ Origin WebRTC: Video + Audio working"
echo "✅ Edge 1 WebRTC: Video + Audio working"
echo "✅ Edge 2 WebRTC: Video + Audio working"
echo "✅ All HLS streams: Video + Audio working"
echo ""

echo "🔄 The test stream will run until you stop it manually"
echo "Press Ctrl+C to stop this script (stream will continue running)"
echo ""

# Keep script running to show it's active
echo "Stream is active. Test your WebRTC connections now!"
echo "Stream PID: $FFMPEG_PID"

# Wait for user to stop
trap "echo 'Stopping test stream...'; kill $FFMPEG_PID 2>/dev/null; exit 0" SIGINT SIGTERM

# Keep the script running
while kill -0 $FFMPEG_PID 2>/dev/null; do
    echo "🔴 Test stream still running... ($(date))"
    sleep 30
done

echo "Test stream ended." 