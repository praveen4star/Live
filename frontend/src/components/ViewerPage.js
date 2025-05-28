import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import Hls from "hls.js";
import axios from "axios";
import { Card, Button, ButtonGroup } from "react-bootstrap";

const ViewerPage = () => {
  const { streamId } = useParams();
  const videoRef = useRef(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [player, setPlayer] = useState(null);
  // Reference to store variants without triggering re-renders
  const variantsRef = useRef([]);
  // Add state for connection info
  const [connectionInfo, setConnectionInfo] = useState({
    status: "Checking...",
    resolution: "",
    lastError: null,
  });
  // Add quality selection state
  const [currentQuality, setCurrentQuality] = useState("auto");
  const [availableQualities, setAvailableQualities] = useState([]);

  // Check if the stream is live
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    const checkStreamStatus = async () => {
      try {
        console.log(
          `Checking stream status for ${streamId} (attempt ${retryCount + 1}/${
            maxRetries + 1
          })`
        );

        // First attempt - Check SRS API
        let isStreamActive = false;
        try {
          const response = await axios.get(
            `http://localhost:1985/api/v1/streams/`
          );

          if (response.data.streams && response.data.streams.length > 0) {
            // Group streams by their base key for better organization
            const allVariants = response.data.streams.filter((stream) =>
              stream.name.startsWith(streamId)
            );

            console.log(
              `Found ${allVariants.length} stream variants in SRS API`
            );

            // Store variants in ref instead of state to avoid re-renders
            variantsRef.current = allVariants.map((stream) => stream.name);
            console.log("Available stream variants:", variantsRef.current);

            // Check for specific quality variants
            const qualities = [];
            if (variantsRef.current.some((name) => name.includes("_360p")))
              qualities.push("360p");
            if (variantsRef.current.some((name) => name.includes("_480p")))
              qualities.push("480p");
            if (variantsRef.current.some((name) => name.includes("_720p")))
              qualities.push("720p");

            if (qualities.length > 0) {
              console.log("Available quality variants:", qualities);
              setAvailableQualities(["auto", ...qualities]);
            }

            // Find if there are any active streams
            if (allVariants.length > 0) {
              // First, check for any variant with an active publisher
              const activeVariants = allVariants.filter(
                (stream) => stream.publish && stream.publish.active
              );

              console.log(`Found ${activeVariants.length} active publishers`);

              if (activeVariants.length > 0) {
                isStreamActive = true;
                console.log("Stream is active with at least one publisher");
              } else {
                // If no active publishers, check if there are any clients connected
                const anyClients = allVariants.some(
                  (stream) => stream.clients > 0
                );
                isStreamActive = anyClients;
                console.log(
                  `No active publishers, stream active status: ${isStreamActive}`
                );
              }
            }
          } else {
            console.log("No streams found in SRS API");
          }
        } catch (err) {
          console.error("Error checking SRS API:", err);
        }

        // Second attempt - Check if base m3u8 file exists
        if (!isStreamActive) {
          console.log(
            "Stream not active from API check, trying m3u8 file existence"
          );

          try {
            // Check the base stream
            try {
              const hlsResponse = await axios.head(
                `http://localhost:8080/live/${streamId}.m3u8`
              );
              if (hlsResponse.status === 200) {
                console.log(`Found valid base HLS stream: ${streamId}.m3u8`);
                isStreamActive = true;

                // Check for quality variants
                const qualities = [];
                try {
                  await axios.head(
                    `http://localhost:8080/live/${streamId}_360p.m3u8`
                  );
                  qualities.push("360p");
                } catch (e) {}

                try {
                  await axios.head(
                    `http://localhost:8080/live/${streamId}_480p.m3u8`
                  );
                  qualities.push("480p");
                } catch (e) {}

                try {
                  await axios.head(
                    `http://localhost:8080/live/${streamId}_720p.m3u8`
                  );
                  qualities.push("720p");
                } catch (e) {}

                if (qualities.length > 0) {
                  console.log("Available quality variants:", qualities);
                  setAvailableQualities(["auto", ...qualities]);
                }
              }
            } catch (e) {
              console.log("Base HLS stream not available:", e.message);
            }
          } catch (err) {
            console.error("Error checking HLS files:", err);
          }
        }

        setIsLive(isStreamActive);

        // If still not active but we have retries left, try again after a delay
        if (!isStreamActive && retryCount < maxRetries) {
          retryCount++;
          console.log(
            `Stream not active, retrying in 2 seconds (${retryCount}/${maxRetries})`
          );
          setTimeout(checkStreamStatus, 2000);
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error("Error checking stream status:", err);

        // Retry on error if we have retries left
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(
            `Error occurred, retrying in 2 seconds (${retryCount}/${maxRetries})`
          );
          setTimeout(checkStreamStatus, 2000);
          return;
        }

        setError("Failed to check stream status");
        setLoading(false);
      }
    };

    checkStreamStatus();
    const interval = setInterval(() => {
      // Reset retry count for periodic checks
      retryCount = 0;
      checkStreamStatus();
    }, 5000); // Check every 5 seconds

    return () => {
      clearInterval(interval);
      cleanupPlayer();
    };
  }, [streamId]);

  const cleanupPlayer = () => {
    if (player) {
      if (player.destroy) {
        player.destroy();
      }
      setPlayer(null);
    }
  };

  useEffect(() => {
    if (isLive && videoRef.current) {
      cleanupPlayer();
      initHlsPlayer();
    }
  }, [isLive, streamId, currentQuality]);

  const initHlsPlayer = () => {
    const video = videoRef.current;
    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveDurationInfinity: true,
        debug: true, // Enable detailed HLS debugging
      });

      // Choose URL based on selected quality
      let hlsUrl;
      if (currentQuality === "auto" || currentQuality === "") {
        // Always use the base stream URL for auto quality
        hlsUrl = `http://localhost:8080/live/${streamId}.m3u8`;
      } else {
        // Use specific quality variant
        hlsUrl = `http://localhost:8080/live/${streamId}_${currentQuality}.m3u8`;
      }

      console.log(
        `Loading HLS stream from URL: ${hlsUrl} (Quality: ${currentQuality})`
      );

      // Add event listener for manifest loading
      hls.on(Hls.Events.MANIFEST_LOADING, () => {
        console.log("HLS manifest loading from:", hlsUrl);
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      // Add better error handling specifically for HLS
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS Error:", data);
        console.error("Error details:", data.details);
        console.error("Error type:", data.type);
        console.error("Error fatal:", data.fatal);

        setConnectionInfo((prev) => ({
          ...prev,
          status: data.fatal ? "Fatal Error" : "Warning",
          lastError: `${data.type}: ${data.details}`,
        }));

        // For media errors, try to recover
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("HLS network error, attempting to recover");

              // If it's a manifest loading error, try alternative URL formats
              if (
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT
              ) {
                console.log(
                  "Manifest loading error, trying alternative URL formats"
                );

                // If we're using a specific quality and it fails, fall back to auto
                if (currentQuality !== "auto") {
                  console.log(
                    "Quality-specific stream failed, falling back to auto quality"
                  );
                  setCurrentQuality("auto");
                  return;
                }

                // Try alternative URL formats
                let alternativeUrl;

                if (hlsUrl.includes("localhost")) {
                  // Try with IP address instead of localhost
                  alternativeUrl = hlsUrl.replace("localhost", "127.0.0.1");
                  console.log(
                    "Trying IP address instead of localhost:",
                    alternativeUrl
                  );
                  hls.loadSource(alternativeUrl);
                } else {
                  // Just retry the load
                  hls.startLoad();
                }
              } else {
                hls.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("HLS media error, attempting to recover");
              hls.recoverMediaError();
              break;
            default:
              // Try to discover available stream variants
              axios
                .get(`http://localhost:8080/live/`)
                .then((response) => {
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(
                    response.data,
                    "text/html"
                  );
                  const links = Array.from(doc.querySelectorAll("a"));

                  // Find m3u8 files that match our stream
                  const m3u8Files = links
                    .map((link) => link.getAttribute("href"))
                    .filter(
                      (href) =>
                        href &&
                        href.startsWith(streamId) &&
                        href.endsWith(".m3u8")
                    );

                  console.log("Available m3u8 files:", m3u8Files);

                  if (m3u8Files.length > 0) {
                    // Get the first matching m3u8 file
                    const discoveredUrl = `http://localhost:8080/live/${m3u8Files[0]}`;
                    console.log("Discovered fallback URL:", discoveredUrl);
                    hls.loadSource(discoveredUrl);
                    hls.startLoad();
                  } else {
                    console.error(
                      "Cannot recover from HLS error, no streams found"
                    );
                    hls.destroy();
                    setError(
                      "Cannot load HLS stream. Check if the stream is active."
                    );
                  }
                })
                .catch((err) => {
                  console.error("Cannot recover from HLS error", err);

                  // Last resort - try accessing the server with raw file path
                  try {
                    const rawUrl = `/live/${streamId}.m3u8`;
                    console.log("Trying raw path as last resort:", rawUrl);
                    hls.loadSource(rawUrl);
                    hls.startLoad();
                  } catch (finalErr) {
                    hls.destroy();
                    setError(
                      "Cannot load HLS stream. Check if the stream is active."
                    );
                  }
                });
              break;
          }
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log("HLS manifest parsed successfully", data);

        // Update available qualities from the manifest if using auto quality
        if (
          currentQuality === "auto" &&
          data &&
          data.levels &&
          data.levels.length > 0
        ) {
          const manifestQualities = data.levels.map((level) => {
            const height = level.height;
            if (height <= 360) return "360p";
            if (height <= 480) return "480p";
            return "720p";
          });

          const uniqueQualities = [...new Set(manifestQualities)];
          console.log("Qualities detected from manifest:", uniqueQualities);

          if (uniqueQualities.length > 0) {
            setAvailableQualities(["auto", ...uniqueQualities]);
          }
        }

        setConnectionInfo({
          status: "Connected",
          resolution:
            data && data.levels && data.levels[0]
              ? `${data.levels[0].width}x${data.levels[0].height}`
              : "Unknown",
          lastError: null,
        });

        video.play().catch((err) => {
          console.error("Error playing video:", err);
          setConnectionInfo((prev) => ({
            ...prev,
            status: "Play Error",
            lastError: err.message,
          }));
        });
      });

      // Enable quality selection for auto mode
      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        if (
          currentQuality === "auto" &&
          data.level >= 0 &&
          hls.levels[data.level]
        ) {
          const level = hls.levels[data.level];
          console.log(
            `HLS auto-switched to level: ${data.level}, resolution: ${level.width}x${level.height}`
          );

          setConnectionInfo((prev) => ({
            ...prev,
            resolution: `${level.width}x${level.height} (Auto)`,
          }));
        }
      });

      setPlayer(hls);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari)
      // Choose URL based on selected quality
      let videoSrc;
      if (currentQuality === "auto" || currentQuality === "") {
        videoSrc = `http://localhost:8080/live/${streamId}.m3u8`;
      } else {
        videoSrc = `http://localhost:8080/live/${streamId}_${currentQuality}.m3u8`;
      }

      video.src = videoSrc;
      console.log(
        `Native HLS playback: ${videoSrc} (Quality: ${currentQuality})`
      );
      video.play().catch((err) => {
        console.error("Error playing video:", err);

        // If specific quality fails, try auto
        if (currentQuality !== "auto") {
          console.log(
            "Quality-specific stream failed in Safari, falling back to auto quality"
          );
          setCurrentQuality("auto");
        } else {
          // Last resort fallback
          console.log("Error playing video, updating error state");
          setConnectionInfo((prev) => ({
            ...prev,
            status: "Play Error",
            lastError: err.message,
          }));
        }
      });
    } else {
      setError("Your browser does not support HLS playback");
    }
  };

  // Handle quality change
  const handleQualityChange = (quality) => {
    console.log(`Changing quality to ${quality}`);
    setCurrentQuality(quality);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div>
        <div className="alert alert-danger">{error}</div>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (!isLive) {
    return <div>Stream is not live</div>;
  }

  return (
    <div>
      <Card className="mb-4">
        <Card.Header>
          <h2>Viewing Stream: {streamId}</h2>
          <div className="stream-status">
            <small className={isLive ? "text-success" : "text-danger"}>
              Status: {isLive ? "Live" : "Offline"}
              {connectionInfo.status !== "Connected" &&
                ` - ${connectionInfo.status}`}
            </small>
            {connectionInfo.resolution && (
              <small className="ms-3">
                Resolution: {connectionInfo.resolution}
              </small>
            )}
            {connectionInfo.lastError && (
              <small className="text-danger d-block mt-1">
                Last Error: {connectionInfo.lastError}
              </small>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          <div className="video-container">
            <video
              ref={videoRef}
              controls
              playsInline
              style={{ width: "100%", maxHeight: "70vh" }}
            ></video>
          </div>

          {/* Quality selection controls */}
          {availableQualities.length > 1 && (
            <div className="quality-controls mt-3">
              <div className="d-flex align-items-center">
                <span className="me-2">Quality:</span>
                <ButtonGroup>
                  {availableQualities.map((quality) => (
                    <Button
                      key={quality}
                      variant={
                        quality === currentQuality
                          ? "primary"
                          : "outline-secondary"
                      }
                      onClick={() => handleQualityChange(quality)}
                      size="sm"
                    >
                      {quality === "auto" ? "Auto" : quality}
                    </Button>
                  ))}
                </ButtonGroup>
              </div>
            </div>
          )}

          {!isLive && !loading && (
            <div className="alert alert-warning mt-3">
              Stream is currently offline. It will automatically connect when it
              becomes available.
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default ViewerPage;
