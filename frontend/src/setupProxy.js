/**
 * Proxy setup for development to avoid CORS issues
 * Proxies requests to the OME server
 */
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // Proxy for HLS streaming - match all hls related paths
  app.use(
    "/hls",
    createProxyMiddleware({
      target: "http://localhost:8080",
      changeOrigin: true,
      pathRewrite: {
        "^/hls": "", // Remove the /hls prefix when forwarding
      },
      logLevel: "debug",
      onProxyRes: function (proxyRes, req, res) {
        // Set headers to avoid CORS issues with video streaming
        proxyRes.headers["Access-Control-Allow-Origin"] = "*";
        proxyRes.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";

        // Log the proxied URL for debugging
        console.log(
          `[HLS Proxy] ${req.method} ${req.path} -> ${proxyRes.statusCode}`
        );

        // Add proper content type headers if missing
        if (req.path.endsWith(".m3u8") && !proxyRes.headers["content-type"]) {
          proxyRes.headers["content-type"] = "application/vnd.apple.mpegurl";
        } else if (
          req.path.endsWith(".ts") &&
          !proxyRes.headers["content-type"]
        ) {
          proxyRes.headers["content-type"] = "video/mp2t";
        }
      },
      // Don't buffer responses
      buffer: false,
      // Set higher timeout for streaming
      timeout: 30000,
    })
  );

  // Add route specifically for HLS playlists - handle both .m3u8 patterns
  app.use(
    "/**/*.m3u8",
    createProxyMiddleware({
      target: "http://localhost:8080",
      changeOrigin: true,
      logLevel: "debug",
      onProxyRes: function (proxyRes, req, res) {
        proxyRes.headers["content-type"] = "application/vnd.apple.mpegurl";
        proxyRes.headers["Access-Control-Allow-Origin"] = "*";
        console.log(
          `[M3U8 Proxy] ${req.method} ${req.path} -> ${proxyRes.statusCode}`
        );
      },
    })
  );

  // Add route specifically for TS segments
  app.use(
    "/**/*.ts",
    createProxyMiddleware({
      target: "http://localhost:8080",
      changeOrigin: true,
      logLevel: "debug",
      onProxyRes: function (proxyRes, req, res) {
        proxyRes.headers["content-type"] = "video/mp2t";
        proxyRes.headers["Access-Control-Allow-Origin"] = "*";
      },
    })
  );

  // Proxy for WebRTC (optional - usually handled by direct connection)
  app.use(
    "/webrtc",
    createProxyMiddleware({
      target: "http://localhost:3333",
      changeOrigin: true,
      ws: true, // Important for WebSocket connections
      pathRewrite: {
        "^/webrtc": "", // Remove the /webrtc prefix when forwarding
      },
      logLevel: "debug",
    })
  );

  // Proxy for backend API
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:3000",
      changeOrigin: true,
      logLevel: "debug",
    })
  );

  // Log proxy setup
  console.log("Proxy middleware configured for video streaming");
};
