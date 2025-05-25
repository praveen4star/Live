const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const http = require("http");

console.log("RTMP and HLS Test Script");
console.log("=======================");

// 1. Check if FFmpeg is installed
console.log("Step 1: Checking FFmpeg installation...");
exec("which ffmpeg", (error, stdout, stderr) => {
  if (error) {
    console.error("❌ FFmpeg not found. Install FFmpeg first:");
    console.error("- For macOS: brew install ffmpeg");
    console.error("- For Ubuntu/Debian: apt-get install ffmpeg");
    console.error(
      "- For Windows: download from https://ffmpeg.org/download.html"
    );
    process.exit(1);
  }

  const ffmpegPath = stdout.trim();
  console.log(`✅ FFmpeg found at: ${ffmpegPath}`);

  // 2. Check if media directory exists
  console.log("\nStep 2: Checking media directory...");
  const mediaDir = path.join(__dirname, "media");
  const liveDir = path.join(mediaDir, "live");

  if (!fs.existsSync(mediaDir)) {
    console.log(`Creating media directory at: ${mediaDir}`);
    fs.mkdirSync(mediaDir, { recursive: true });
  } else {
    console.log(`✅ Media directory exists at: ${mediaDir}`);
  }

  if (!fs.existsSync(liveDir)) {
    console.log(`Creating live directory at: ${liveDir}`);
    fs.mkdirSync(liveDir, { recursive: true });
  } else {
    console.log(`✅ Live directory exists at: ${liveDir}`);

    // Check directory permissions
    try {
      const testFile = path.join(liveDir, "test.txt");
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
      console.log("✅ Live directory is writable");
    } catch (err) {
      console.error("❌ Live directory is not writable:", err.message);
      console.error("Fix permissions with: chmod -R 755 " + liveDir);
    }

    // List contents
    const items = fs.readdirSync(liveDir);
    console.log(`Live directory contains ${items.length} items`);
    if (items.length > 0) {
      console.log("First few items:", items.slice(0, 5));
    }
  }

  // 3. Test HTTP server on port 8000
  console.log("\nStep 3: Testing HTTP server on port 8000...");
  const req = http.get("http://localhost:8000", (res) => {
    console.log(`✅ HTTP server is running. Status: ${res.statusCode}`);

    // 4. Provide test commands
    console.log("\nStep 4: Test RTMP streaming");
    console.log("To test RTMP streaming, use one of these commands:");
    console.log("\nWith FFmpeg:");
    console.log(
      `${ffmpegPath} -re -i [INPUT_FILE] -c copy -f flv rtmp://localhost:1935/live/test`
    );
    console.log("\nExample with test pattern:");
    console.log(
      `${ffmpegPath} -re -f lavfi -i testsrc=size=1280x720:rate=30 -c:v libx264 -b:v 1000k -f flv rtmp://localhost:1935/live/test`
    );
    console.log("\nThen access the HLS stream at:");
    console.log("http://localhost:8000/live/test/index.m3u8");

    console.log("\nTest complete! ✅");
  });

  req.on("error", (err) => {
    console.error("❌ HTTP server test failed:", err.message);
    console.error("Make sure your server is running with: npm start");
  });

  req.end();
});
