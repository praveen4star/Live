import React, { useEffect, useRef, useState, useCallback } from "react";
import OvenPlayer from "ovenplayer";
// Import HLS.js directly to ensure it's available
import Hls from "hls.js";

// Make Hls available globally so OvenPlayer can find it
window.Hls = Hls;

/**
 * VideoPlayer component with adaptive playback using OvenPlayer
 * Supports both WebRTC and LL-HLS with edge server selection
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
  const [selectedServer, setSelectedServer] = useState("origin"); // origin, edge1, edge2, auto
  const [protocolStatus, setProtocolStatus] = useState({
    hls: "unknown",
    webrtc: "unknown",
  });
  const [streamAvailability, setStreamAvailability] = useState(null);
  const [serverStatus, setServerStatus] = useState({
    origin: "unknown",
    edge1: "unknown",
    edge2: "unknown",
  });

  // Server configuration
  const serverConfig = {
    origin: {
      name: "Origin Server",
      hls: process.env.REACT_APP_ORIGIN_HLS_URL || "http://localhost:8080",
      webrtc: process.env.REACT_APP_ORIGIN_WEBRTC_URL || "ws://localhost:3333",
    },
    edge1: {
      name: "Edge Server 1",
      hls: process.env.REACT_APP_EDGE1_HLS_URL || "http://localhost:8090",
      webrtc: process.env.REACT_APP_EDGE1_WEBRTC_URL || "ws://localhost:3343",
    },
    edge2: {
      name: "Edge Server 2",
      hls: process.env.REACT_APP_EDGE2_HLS_URL || "http://localhost:8091",
      webrtc: process.env.REACT_APP_EDGE2_WEBRTC_URL || "ws://localhost:3353",
    },
  };

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

  // Test if a stream is available on a specific server
  const testStreamAvailability = async (streamId, server = selectedServer) => {
    try {
      const config = serverConfig[server];
      if (!config) {
        return { available: false, error: "Invalid server configuration" };
      }

      const hlsUrl = `${config.hls}/app/${streamId}/llhls.m3u8`;
      const response = await fetch(hlsUrl, {
        method: "HEAD",
        timeout: 5000,
      });

      if (response.ok) {
        return { available: true, protocol: "hls", server };
      } else if (response.status === 404) {
        return { available: false, error: "Stream not found (404)", server };
      } else {
        return { available: false, error: `HTTP ${response.status}`, server };
      }
    } catch (error) {
      console.warn(`Stream availability test failed for ${server}:`, error);
      return { available: false, error: error.message, server };
    }
  };

  // Test all servers and find the best one
  const findBestServer = async (streamId) => {
    const servers = ["origin", "edge1", "edge2"];
    const results = await Promise.all(
      servers.map(async (server) => {
        const result = await testStreamAvailability(streamId, server);
        return { server, ...result };
      })
    );

    // Update server status
    const newServerStatus = {};
    results.forEach((result) => {
      newServerStatus[result.server] = result.available ? "active" : "failed";
    });
    console.log("newServerStatus", newServerStatus);
    setServerStatus(newServerStatus);

    // Find the first available server
    const availableServer = results.find((result) => result.available);
    return availableServer ? availableServer.server : "origin";
  };

  // Get the current server configuration
  const getCurrentServerConfig = () => {
    if (selectedServer === "auto") {
      // For auto mode, prefer edge servers over origin
      const availableServers = Object.entries(serverStatus)
        .filter(([_, status]) => status === "active")
        .map(([server]) => server);

      if (availableServers.includes("edge1")) return serverConfig.edge1;
      if (availableServers.includes("edge2")) return serverConfig.edge2;
      return serverConfig.origin;
    }
    return serverConfig[selectedServer] || serverConfig.origin;
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
  }, [generatedStreamId, preferredProtocol, selectedServer]);

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

      // Auto-select best server if needed
      let currentServer = selectedServer;
      if (selectedServer === "auto") {
        currentServer = await findBestServer(generatedStreamId);
        console.log(`Auto-selected server: ${currentServer}`);
      }

      const config = serverConfig[currentServer];
      if (!config) {
        setError("Invalid server configuration");
        return;
      }

      // Check if OvenPlayer is properly loaded
      if (typeof OvenPlayer === "undefined" || !OvenPlayer.create) {
        console.error("OvenPlayer is not properly loaded");
        setError("Media player library not loaded properly");
        return;
      }

      // Build sources array based on preferred protocol and server
      let sources = [];

      if (preferredProtocol === "auto" || preferredProtocol === "hls") {
        const hlsUrl = `${config.hls}/app/${generatedStreamId}/llhls.m3u8`;

        try {
          new URL(hlsUrl);
          sources.push({
            type: "hls",
            file: hlsUrl,
            label: `LL-HLS (${config.name})`,
          });
        } catch (urlError) {
          console.error("Invalid HLS URL constructed:", hlsUrl, urlError);
          setError("Failed to construct valid HLS URL");
          return;
        }
      }

      if (preferredProtocol === "auto" || preferredProtocol === "webrtc") {
        const webrtcBaseUrl = `${config.webrtc}/app/${generatedStreamId}`;
        const webrtcUrl = generatedStreamKey
          ? `${webrtcBaseUrl}?token=${generatedStreamKey}`
          : webrtcBaseUrl;

        try {
          new URL(webrtcUrl);
          sources.push({
            type: "webrtc",
            file: webrtcUrl,
            label: `WebRTC (${config.name})`,
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
      console.log("Using server:", config.name);

      // Remove existing player if there is one
      if (playerRef.current) {
        try {
          playerRef.current.remove();
          playerRef.current = null;
        } catch (err) {
          console.error("Error removing existing player:", err);
        }
      }

      // Initialize OvenPlayer
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
            maxVideoBitrate: 2500,
            maxAudioBitrate: 128,
            videoRecvCodec: "H264",
            preferredCodecProfile: "42e01f",
            iceTransportPolicy: "all",
            rtcConfiguration: {
              bundlePolicy: "max-bundle",
              rtcpMuxPolicy: "require",
              sdpSemantics: "unified-plan",
              encodedInsertableStreams: false,
            },
            forceTurn: false,
            peerConnectionConfig: {
              sdpSemantics: "unified-plan",
            },
          },
          lowLatencyModeHls: true,
          hlsConfig: {
            liveSyncDuration: 1.5,
            liveMaxLatencyDuration: 6,
            liveDurationInfinity: true,
            enableWorker: true,
            forceKeyFrameOnDiscontinuity: true,
            appendErrorMaxRetry: 3,
          },
          mute: false,
          volume: 80,
          debug: true,
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
        handlePlayerError(error);
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
        updateProtocolStatus(source.type);
      });

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
    selectedServer,
    hlsSupported,
    autoplay,
  ]);

  const handlePlayerError = (error) => {
    let errorMessage = "Unknown error";

    if (error.code === 1002) {
      setProtocolStatus((prev) => ({ ...prev, webrtc: "failed" }));
      errorMessage = "WebRTC connection failed. Trying edge servers...";

      // Auto-fallback to edge servers
      if (selectedServer === "origin") {
        setSelectedServer("edge1");
        return;
      } else if (selectedServer === "edge1") {
        setSelectedServer("edge2");
        return;
      }
    } else if (error.code === 1001) {
      setProtocolStatus((prev) => ({ ...prev, hls: "failed" }));
      errorMessage = "HLS playback failed. Trying alternative servers...";
    } else if (error.message && error.message.includes("404")) {
      errorMessage = "Stream not found. Make sure the stream is active.";
    } else if (error.message) {
      errorMessage = error.message;
    }

    setError(`Playback error: ${errorMessage}`);
  };

  const updateProtocolStatus = (sourceType) => {
    if (sourceType === "hls") {
      setProtocolStatus((prev) => ({
        ...prev,
        hls: "active",
        webrtc: preferredProtocol === "webrtc" ? "failed" : "inactive",
      }));
    } else if (sourceType === "webrtc") {
      setProtocolStatus((prev) => ({
        ...prev,
        webrtc: "active",
        hls: preferredProtocol === "hls" ? "failed" : "inactive",
      }));
    }
  };

  const handleReloadPlayer = () => {
    if (playerRef.current) {
      try {
        playerRef.current.remove();
      } catch (err) {
        console.error("Error removing player during reload:", err);
      }
      playerRef.current = null;
    }

    setTimeout(() => {
      initializePlayer();
    }, 100);
  };

  const handleProtocolChange = (protocol) => {
    setPreferredProtocol(protocol);
    if (playerRef.current) {
      handleReloadPlayer();
    }
  };

  const handleServerChange = (server) => {
    setSelectedServer(server);
    if (playerRef.current) {
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

    if (selectedServer === "auto") {
      const bestServer = await findBestServer(generatedStreamId);
      const result = await testStreamAvailability(
        generatedStreamId,
        bestServer
      );
      setStreamAvailability(result);
    } else {
      const result = await testStreamAvailability(
        generatedStreamId,
        selectedServer
      );
      setStreamAvailability(result);
    }
  };

  const getCurrentServerName = () => {
    if (selectedServer === "auto") {
      const availableServers = Object.entries(serverStatus)
        .filter(([_, status]) => status === "active")
        .map(([server]) => server);

      if (availableServers.includes("edge1")) return serverConfig.edge1.name;
      if (availableServers.includes("edge2")) return serverConfig.edge2.name;
      return serverConfig.origin.name;
    }
    return serverConfig[selectedServer]?.name || "Unknown Server";
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
            Server Selection:
          </label>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => handleServerChange("auto")}
              style={{
                padding: "8px 15px",
                backgroundColor:
                  selectedServer === "auto" ? "#4CAF50" : "#f1f1f1",
                color: selectedServer === "auto" ? "white" : "black",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Auto Select
            </button>
            <button
              onClick={() => handleServerChange("origin")}
              style={{
                padding: "8px 15px",
                backgroundColor:
                  selectedServer === "origin" ? "#4CAF50" : "#f1f1f1",
                color: selectedServer === "origin" ? "white" : "black",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Origin Server
            </button>
            <button
              onClick={() => handleServerChange("edge1")}
              style={{
                padding: "8px 15px",
                backgroundColor:
                  selectedServer === "edge1" ? "#4CAF50" : "#f1f1f1",
                color: selectedServer === "edge1" ? "white" : "black",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Edge Server 1
            </button>
            <button
              onClick={() => handleServerChange("edge2")}
              style={{
                padding: "8px 15px",
                backgroundColor:
                  selectedServer === "edge2" ? "#4CAF50" : "#f1f1f1",
                color: selectedServer === "edge2" ? "white" : "black",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Edge Server 2
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
              ? `✓ Stream is available on ${streamAvailability.server}`
              : `✗ ${streamAvailability.error || "Stream not available"} on ${
                  streamAvailability.server
                }`}
          </div>
        )}

        {/* Server Status Display */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "10px",
            borderRadius: "4px",
            marginBottom: "10px",
            border: "1px solid #ddd",
          }}
        >
          <h4 style={{ marginTop: 0 }}>Server Status</h4>
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
            {Object.entries(serverConfig).map(([key, config]) => (
              <div
                key={key}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  backgroundColor:
                    serverStatus[key] === "active"
                      ? "#e6ffe6"
                      : serverStatus[key] === "failed"
                      ? "#ffe6e6"
                      : "#f9f9f9",
                  border: `1px solid ${
                    serverStatus[key] === "active"
                      ? "#4CAF50"
                      : serverStatus[key] === "failed"
                      ? "#ff6666"
                      : "#ddd"
                  }`,
                }}
              >
                <span style={{ fontWeight: "bold" }}>{config.name}:</span>{" "}
                {serverStatus[key] === "active"
                  ? "Active ✓"
                  : serverStatus[key] === "failed"
                  ? "Failed ✗"
                  : "Unknown"}
              </div>
            ))}
          </div>
        </div>

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
              <strong>RTMP URL:</strong> rtmp://localhost:1935/app (Origin Only)
            </p>
            <p>
              <strong>Stream Name/Key:</strong> {generatedStreamId}?token=
              {generatedStreamKey}
            </p>
            <p>
              <strong>Current Server:</strong> {getCurrentServerName()}
            </p>

            <div style={{ marginTop: "15px" }}>
              <h5>Server URLs:</h5>
              <ul style={{ paddingLeft: "20px" }}>
                <li>
                  <strong>Origin HLS:</strong> {serverConfig.origin.hls}/app/
                  {generatedStreamId}/llhls.m3u8
                </li>
                <li>
                  <strong>Edge 1 HLS:</strong> {serverConfig.edge1.hls}/app/
                  {generatedStreamId}/llhls.m3u8
                </li>
                <li>
                  <strong>Edge 2 HLS:</strong> {serverConfig.edge2.hls}/app/
                  {generatedStreamId}/llhls.m3u8
                </li>
                <li>
                  <strong>Origin WebRTC:</strong> {serverConfig.origin.webrtc}
                  /app/{generatedStreamId}
                </li>
                <li>
                  <strong>Edge 1 WebRTC:</strong> {serverConfig.edge1.webrtc}
                  /app/{generatedStreamId}
                </li>
                <li>
                  <strong>Edge 2 WebRTC:</strong> {serverConfig.edge2.webrtc}
                  /app/{generatedStreamId}
                </li>
              </ul>
            </div>

            <div style={{ marginTop: "15px" }}>
              <h4>OBS Setup (Stream to Origin)</h4>
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
              <h4>FFmpeg Command (Stream to Origin)</h4>
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
            {currentProtocol === "webrtc" ? "WebRTC" : "LL-HLS"} -{" "}
            {getCurrentServerName()}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
