import React, { useEffect, useRef, useState, useCallback } from "react";
import OvenPlayer from "ovenplayer";
// Import HLS.js directly to ensure it's available
import Hls from "hls.js";

// Make Hls available globally so OvenPlayer can find it
window.Hls = Hls;

/**
 * VideoPlayer component with adaptive playback using OvenPlayer
 * Supports both WebRTC and LL-HLS with automatic fallback
 */
const VideoPlayer = ({
  streamId,
  autoplay = true,
  width = "100%",
  height = "100%",
}) => {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [currentProtocol, setCurrentProtocol] = useState(null);
  const [generatedStreamKey, setGeneratedStreamKey] = useState("");
  const [generatedStreamId, setGeneratedStreamId] = useState(streamId || "");
  const [showStreamInfo, setShowStreamInfo] = useState(false);
  const [hlsSupported] = useState(Hls.isSupported());
  const [preferredProtocol, setPreferredProtocol] = useState("hls"); // auto, hls, webrtc
  const [protocolStatus, setProtocolStatus] = useState({
    hls: "unknown",
    webrtc: "unknown",
  });
  const [streamAvailability, setStreamAvailability] = useState(null);

  // Generate a random stream key
  const generateStreamKey = () => {
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const charactersLength = characters.length;
    for (let i = 0; i < 24; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    setGeneratedStreamKey(result);
    return result;
  };

  // Generate a random stream ID
  const generateStreamId = () => {
    const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0,
          v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
    setGeneratedStreamId(uuid);
    return uuid;
  };

  // Test if a stream is available
  const testStreamAvailability = async (streamId) => {
    try {
      const hlsUrl = `http://localhost:8080/app/${streamId}/llhls.m3u8`;
      const response = await fetch(hlsUrl, {
        method: "HEAD",
        timeout: 5000,
      });

      if (response.ok) {
        return { available: true, protocol: "hls" };
      } else if (response.status === 404) {
        return { available: false, error: "Stream not found (404)" };
      } else {
        return { available: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      console.warn("Stream availability test failed:", error);
      return { available: false, error: error.message };
    }
  };

  // Clean up player on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.remove();
        } catch (err) {
          console.error("Error removing player:", err);
        }
        playerRef.current = null;
      }
    };
  }, []);

  // Generate stream key on first load if not provided
  useEffect(() => {
    if (!generatedStreamKey) {
      generateStreamKey();
    }
  }, [generatedStreamKey]);

  // Initialize player when container and stream ID are ready
  useEffect(() => {
    if (!generatedStreamId || !containerRef.current) return;

    // Use a timeout to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      if (!playerRef.current) {
        initializePlayer();
      }
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedStreamId, preferredProtocol]); // Disable exhaustive deps to avoid circular dependency

  const initializePlayer = useCallback(async () => {
    try {
      setError(null);
      setProtocolStatus({
        hls: "initializing",
        webrtc: "initializing",
      });

      // Safety check for container
      if (!containerRef.current) {
        console.error("Player container not found");
        setError("Player container not found");
        return;
      }

      // Validate stream ID format
      if (!generatedStreamId || generatedStreamId.trim() === "") {
        setError("Stream ID is required");
        return;
      }

      // Basic UUID validation for stream ID
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(generatedStreamId)) {
        console.warn("Stream ID does not appear to be a valid UUID format");
      }

      // Check if OvenPlayer is properly loaded
      if (typeof OvenPlayer === "undefined" || !OvenPlayer.create) {
        console.error("OvenPlayer is not properly loaded");
        setError("Media player library not loaded properly");
        return;
      }

      // Verify Hls.js is available
      if (!window.Hls) {
        console.error("Hls.js is not properly loaded");
        setError("HLS library not loaded properly");
        return;
      }

      // Build sources array based on preferred protocol
      let sources = [];

      if (preferredProtocol === "auto" || preferredProtocol === "hls") {
        // Construct HLS URL properly - token should be a query parameter, not part of the path
        const hlsUrl = `http://localhost:8080/app/${generatedStreamId}/llhls.m3u8`;

        // Validate URL construction
        try {
          new URL(hlsUrl);
          sources.push({
            type: "hls",
            file: hlsUrl,
            label: "LL-HLS (Low Latency)",
          });
        } catch (urlError) {
          console.error("Invalid HLS URL constructed:", hlsUrl, urlError);
          setError("Failed to construct valid HLS URL");
          return;
        }
      }

      if (preferredProtocol === "auto" || preferredProtocol === "webrtc") {
        // WebRTC URL construction - token can be part of stream name or query parameter
        const webrtcBaseUrl = `ws://localhost:3333/app/${generatedStreamId}`;
        const webrtcUrl = generatedStreamKey
          ? `${webrtcBaseUrl}?token=${generatedStreamKey}`
          : webrtcBaseUrl;

        // Validate WebRTC URL
        try {
          new URL(webrtcUrl);
          sources.push({
            type: "webrtc",
            file: webrtcUrl,
            label: "WebRTC (Ultra-Low Latency)",
          });
        } catch (urlError) {
          console.error("Invalid WebRTC URL constructed:", webrtcUrl, urlError);
          setError("Failed to construct valid WebRTC URL");
          return;
        }
      }

      if (sources.length === 0) {
        setError("No valid streaming sources configured");
        return;
      }

      console.log("Initializing player with sources:", sources);
      console.log("Container element:", containerRef.current);
      console.log("HLS support:", hlsSupported ? "Yes" : "No");
      console.log("Preferred protocol:", preferredProtocol);

      // Remove existing player if there is one
      if (playerRef.current) {
        try {
          playerRef.current.remove();
          playerRef.current = null;
        } catch (err) {
          console.error("Error removing existing player:", err);
        }
      }

      // Initialize OvenPlayer with error handling
      try {
        playerRef.current = OvenPlayer.create(containerRef.current, {
          sources: sources,
          autoStart: autoplay,
          controls: {
            visible: true,
            showPlayButton: true,
            showMuteButton: true,
            showVolumeButton: true,
            showFullscreenButton: true,
            showSettingsButton: true,
            showPlaybackRateButton: false,
          },
          showBigPlayButton: true,
          showMediaTitle: true,
          autoFallback: true,
          webrtcConfig: {
            timeoutMaxRetry: 3,
            connectionTimeout: 10000,
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
            ],
            maxVideoBitrate: 2500, // Ensure video bitrate is set
            maxAudioBitrate: 128, // Audio bitrate
            videoRecvCodec: "H264", // Explicitly specify video codec
            preferredCodecProfile: "42e01f", // Baseline profile for better compatibility
            iceTransportPolicy: "all", // Use all available ICE candidates
            rtcConfiguration: {
              bundlePolicy: "max-bundle",
              rtcpMuxPolicy: "require",
              sdpSemantics: "unified-plan", // Better for modern browsers
              encodedInsertableStreams: false, // Disable experimental features
            },
            forceTurn: false, // Don't force TURN server usage
            peerConnectionConfig: {
              sdpSemantics: "unified-plan", // Ensure consistent setting
            },
          },
          lowLatencyModeHls: true,
          hlsConfig: {
            // Enhanced HLS settings
            liveSyncDuration: 1.5,
            liveMaxLatencyDuration: 6,
            liveDurationInfinity: true,
            enableWorker: true,
            forceKeyFrameOnDiscontinuity: true,
            appendErrorMaxRetry: 3,
          },
          mute: false, // Start unmuted to ensure audio works
          volume: 80, // Start at 80% volume
          debug: true, // Enable debugging
        });
      } catch (err) {
        console.error("Error creating player instance:", err);
        setError(`Player creation error: ${err.message || "Unknown error"}`);
        return;
      }

      setProtocolStatus((prev) => ({
        ...prev,
        hls: "active",
        webrtc: "active",
      }));

      // Set up event handlers
      playerRef.current.on("error", (error) => {
        console.error("Player error:", error);

        // Handle specific error types with better messages
        let errorMessage = "Unknown error";

        if (error.code === 1002) {
          // WebRTC error
          setProtocolStatus((prev) => ({ ...prev, webrtc: "failed" }));
          errorMessage =
            "WebRTC connection failed. Check if stream is active and WebRTC is properly configured.";
        } else if (error.code === 1001) {
          // HLS error
          setProtocolStatus((prev) => ({ ...prev, hls: "failed" }));
          errorMessage =
            "HLS playback failed. Check if stream is active and HLS endpoint is accessible.";
        } else if (error.message && error.message.includes("404")) {
          errorMessage =
            "Stream not found. Make sure the stream is active and the Stream ID is correct.";
        } else if (
          error.message &&
          error.message.includes("Connection reset")
        ) {
          errorMessage =
            "Connection reset by server. This may indicate a configuration issue or the stream is not available.";
        } else if (error.message) {
          errorMessage = error.message;
        }

        setError(`Playback error: ${errorMessage}`);
      });

      playerRef.current.on("stateChanged", (state) => {
        console.log("Player state changed:", state);
        if (state === "playing") {
          const protocol = playerRef.current.getProviderName();
          if (protocol === "html5") {
            setProtocolStatus((prev) => ({ ...prev, hls: "active" }));
          } else if (protocol === "webrtc") {
            setProtocolStatus((prev) => ({ ...prev, webrtc: "active" }));
          }
        }
      });

      playerRef.current.on("sourceChanged", (source) => {
        console.log("Source changed to:", source);
        setCurrentProtocol(source.type);

        // Update protocol status
        if (source.type === "hls") {
          setProtocolStatus((prev) => ({
            ...prev,
            hls: "active",
            webrtc: preferredProtocol === "webrtc" ? "failed" : "inactive",
          }));
        } else if (source.type === "webrtc") {
          setProtocolStatus((prev) => ({
            ...prev,
            webrtc: "active",
            hls: preferredProtocol === "hls" ? "failed" : "inactive",
          }));
        }
      });

      // Handle stream end
      playerRef.current.on("complete", () => {
        console.log("Stream ended");
      });
    } catch (err) {
      console.error("Error initializing player:", err);
      setError(
        `Failed to initialize player: ${err.message || "Unknown error"}`
      );
    }
  }, [
    generatedStreamId,
    generatedStreamKey,
    preferredProtocol,
    hlsSupported,
    autoplay,
  ]);

  const handleReloadPlayer = () => {
    if (playerRef.current) {
      try {
        playerRef.current.remove();
      } catch (err) {
        console.error("Error removing player during reload:", err);
      }
      playerRef.current = null;
    }

    // Use timeout to ensure DOM updates
    setTimeout(() => {
      initializePlayer();
    }, 100);
  };

  const handleProtocolChange = (protocol) => {
    setPreferredProtocol(protocol);
    if (playerRef.current) {
      // Reload player with new protocol preference
      handleReloadPlayer();
    }
  };

  const handleTestStream = async () => {
    if (!generatedStreamId) {
      setStreamAvailability({
        available: false,
        error: "No stream ID provided",
      });
      return;
    }

    setStreamAvailability({ testing: true });
    const result = await testStreamAvailability(generatedStreamId);
    setStreamAvailability(result);
  };

  return (
    <div style={{ width, position: "relative" }}>
      <div
        className="stream-controls"
        style={{
          marginBottom: "20px",
          padding: "15px",
          backgroundColor: "#f5f5f5",
          borderRadius: "5px",
        }}
      >
        <h3>Stream Configuration</h3>

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              fontWeight: "bold",
            }}
          >
            Stream ID:
          </label>
          <div style={{ display: "flex" }}>
            <input
              type="text"
              value={generatedStreamId}
              onChange={(e) => setGeneratedStreamId(e.target.value)}
              style={{
                flex: 1,
                padding: "8px",
                marginRight: "10px",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            />
            <button
              onClick={generateStreamId}
              style={{
                padding: "8px 15px",
                backgroundColor: "#0078d7",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Generate
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              fontWeight: "bold",
            }}
          >
            Stream Key:
          </label>
          <div style={{ display: "flex" }}>
            <input
              type="text"
              value={generatedStreamKey}
              readOnly
              style={{
                flex: 1,
                padding: "8px",
                marginRight: "10px",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            />
            <button
              onClick={generateStreamKey}
              style={{
                padding: "8px 15px",
                backgroundColor: "#0078d7",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Generate
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              fontWeight: "bold",
            }}
          >
            Preferred Protocol:
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => handleProtocolChange("auto")}
              style={{
                padding: "8px 15px",
                backgroundColor:
                  preferredProtocol === "auto" ? "#4CAF50" : "#f1f1f1",
                color: preferredProtocol === "auto" ? "white" : "black",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Auto (Fallback)
            </button>
            <button
              onClick={() => handleProtocolChange("webrtc")}
              style={{
                padding: "8px 15px",
                backgroundColor:
                  preferredProtocol === "webrtc" ? "#4CAF50" : "#f1f1f1",
                color: preferredProtocol === "webrtc" ? "white" : "black",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              WebRTC Only
            </button>
            <button
              onClick={() => handleProtocolChange("hls")}
              style={{
                padding: "8px 15px",
                backgroundColor:
                  preferredProtocol === "hls" ? "#4CAF50" : "#f1f1f1",
                color: preferredProtocol === "hls" ? "white" : "black",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              HLS Only
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <button
            onClick={handleReloadPlayer}
            style={{
              padding: "10px 20px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              marginRight: "10px",
            }}
          >
            Reload Player
          </button>
          <button
            onClick={handleTestStream}
            style={{
              padding: "10px 20px",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              marginRight: "10px",
            }}
          >
            Test Stream
          </button>
          <button
            onClick={() => setShowStreamInfo(!showStreamInfo)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#ff9800",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {showStreamInfo ? "Hide Streaming Info" : "Show Streaming Info"}
          </button>
        </div>

        {/* Stream Availability Display */}
        {streamAvailability && (
          <div
            style={{
              backgroundColor: streamAvailability.testing
                ? "#fff3cd"
                : streamAvailability.available
                ? "#d4edda"
                : "#f8d7da",
              padding: "10px",
              borderRadius: "4px",
              marginBottom: "10px",
              border: `1px solid ${
                streamAvailability.testing
                  ? "#ffeaa7"
                  : streamAvailability.available
                  ? "#c3e6cb"
                  : "#f5c6cb"
              }`,
            }}
          >
            <strong>Stream Status:</strong>{" "}
            {streamAvailability.testing
              ? "Testing..."
              : streamAvailability.available
              ? "✓ Stream is available"
              : `✗ ${streamAvailability.error || "Stream not available"}`}
          </div>
        )}

        {/* Protocol Status Display */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "10px",
            borderRadius: "4px",
            marginTop: "10px",
            border: "1px solid #ddd",
          }}
        >
          <h4 style={{ marginTop: 0 }}>Protocol Status</h4>
          <div style={{ display: "flex", gap: "15px" }}>
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "4px",
                backgroundColor:
                  protocolStatus.webrtc === "active"
                    ? "#e6ffe6"
                    : protocolStatus.webrtc === "failed"
                    ? "#ffe6e6"
                    : "#f9f9f9",
                border: `1px solid ${
                  protocolStatus.webrtc === "active"
                    ? "#4CAF50"
                    : protocolStatus.webrtc === "failed"
                    ? "#ff6666"
                    : "#ddd"
                }`,
              }}
            >
              <span style={{ fontWeight: "bold" }}>WebRTC:</span>{" "}
              {protocolStatus.webrtc === "active"
                ? "Active ✓"
                : protocolStatus.webrtc === "failed"
                ? "Failed ✗"
                : protocolStatus.webrtc === "initializing"
                ? "Initializing..."
                : "Inactive"}
            </div>
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "4px",
                backgroundColor:
                  protocolStatus.hls === "active"
                    ? "#e6ffe6"
                    : protocolStatus.hls === "failed"
                    ? "#ffe6e6"
                    : "#f9f9f9",
                border: `1px solid ${
                  protocolStatus.hls === "active"
                    ? "#4CAF50"
                    : protocolStatus.hls === "failed"
                    ? "#ff6666"
                    : "#ddd"
                }`,
              }}
            >
              <span style={{ fontWeight: "bold" }}>HLS:</span>{" "}
              {protocolStatus.hls === "active"
                ? "Active ✓"
                : protocolStatus.hls === "failed"
                ? "Failed ✗"
                : protocolStatus.hls === "initializing"
                ? "Initializing..."
                : "Inactive"}
            </div>
          </div>
        </div>

        {showStreamInfo && (
          <div
            style={{
              marginTop: "15px",
              padding: "15px",
              backgroundColor: "#fff",
              borderRadius: "5px",
              border: "1px solid #ddd",
            }}
          >
            <h4>Streaming Information</h4>
            <p>
              <strong>RTMP URL:</strong> rtmp://localhost:1935/app
            </p>
            <p>
              <strong>Stream Name/Key:</strong> {generatedStreamId}?token=
              {generatedStreamKey}
            </p>
            <p>
              <strong>WebRTC URL:</strong> ws://localhost:3333/app/
              {generatedStreamId}
              {generatedStreamKey ? `?token=${generatedStreamKey}` : ""}
            </p>
            <p>
              <strong>HLS URL:</strong> /hls/app/{generatedStreamId}/llhls.m3u8
              (Proxied)
            </p>
            <p>
              <strong>Direct HLS URL:</strong> http://localhost:8080/app/
              {generatedStreamId}/llhls.m3u8
              {generatedStreamKey ? `?token=${generatedStreamKey}` : ""}
            </p>

            <div style={{ marginTop: "15px" }}>
              <h4>OBS Setup</h4>
              <ol style={{ paddingLeft: "20px" }}>
                <li>Open OBS Studio</li>
                <li>Go to Settings → Stream</li>
                <li>Select "Custom..." as the service</li>
                <li>
                  Set Server to: <code>rtmp://localhost:1935/app</code>
                </li>
                <li>
                  Set Stream Key to:{" "}
                  <code>
                    {generatedStreamId}?token={generatedStreamKey}
                  </code>
                </li>
                <li>Click "OK" and then "Start Streaming"</li>
              </ol>
            </div>

            <div style={{ marginTop: "15px" }}>
              <h4>FFmpeg Command</h4>
              <pre
                style={{
                  backgroundColor: "#f9f9f9",
                  padding: "10px",
                  borderRadius: "4px",
                  overflowX: "auto",
                }}
              >
                ffmpeg -re -i [INPUT_FILE] -c:v libx264 -preset veryfast -tune
                zerolatency -c:a aac -ar 44100 -f flv rtmp://localhost:1935/app/
                {generatedStreamId}?token={generatedStreamKey}
              </pre>
            </div>
          </div>
        )}
      </div>

      <div
        className="video-player-container"
        style={{
          width: "100%",
          height: "400px",
          position: "relative",
          backgroundColor: "#000",
        }}
      >
        <div
          ref={containerRef}
          id="player-container"
          style={{ width: "100%", height: "100%" }}
        />

        {error && (
          <div
            className="player-error"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(0,0,0,0.7)",
              color: "white",
              padding: "10px 20px",
              borderRadius: "4px",
              textAlign: "center",
            }}
          >
            {error}
            <button
              onClick={handleReloadPlayer}
              style={{
                marginTop: "10px",
                padding: "5px 10px",
                backgroundColor: "#0078d7",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                display: "block",
                width: "100%",
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {currentProtocol && (
          <div
            className="protocol-indicator"
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              background: "rgba(0,0,0,0.5)",
              color: "white",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "12px",
            }}
          >
            {currentProtocol === "webrtc" ? "WebRTC" : "LL-HLS"}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
