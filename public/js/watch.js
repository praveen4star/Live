document.addEventListener("DOMContentLoaded", () => {
  // Get stream key from URL
  const urlParams = new URLSearchParams(window.location.search);
  const streamKey = urlParams.get("key");

  if (!streamKey) {
    alert("No stream key provided. Redirecting to home page.");
    window.location.href = "/";
    return;
  }

  // DOM elements
  const streamTitle = document.getElementById("stream-title");
  const streamDescription = document.getElementById("stream-description");
  const streamUsername = document.getElementById("stream-username");
  const viewCount = document.getElementById("view-count");
  const chatMessages = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-message");
  const sendMessageBtn = document.getElementById("send-message");

  let player = null;
  let username = localStorage.getItem("username") || "";

  // Create a variable to track if we're using the test stream
  let usingTestStream = false;

  // Define the test stream URL at the top level
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const testHlsUrl = `${protocol}//${hostname}:8000/live/test/index.m3u8?_=${Date.now()}`;

  // Initialize stream
  initializeStream();

  // Set up video player
  function setupVideoPlayer(stream) {
    // Clear any existing player
    if (player) {
      player.dispose();
    }

    // Remove the hls-script inclusion as it's causing conflicts
    // VideoJS 7+ has native HLS support through VHS
    const oldScript = document.getElementById("hls-script");
    if (oldScript) {
      oldScript.parentNode.removeChild(oldScript);
    }

    // Initialize video.js player with HLS tech options
    player = videojs("video-player", {
      liveui: true,
      liveTracker: {
        trackingThreshold: 0,
        liveTolerance: 5,
      },
      html5: {
        vhs: {
          // Use VHS for HLS support (built into VideoJS 7+)
          overrideNative: true,
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
          handleManifestRedirects: true,
          withCredentials: false,
          limitRenditionByPlayerDimensions: false,
          useDevicePixelRatio: true,
          // Add better error handling settings
          handlePartialData: true,
          maxPlaylistRetries: 3,
          // Add low latency settings
          liveBackBufferLength: 10,
          liveSyncDuration: 1, // Target a 1-second buffer for live
          liveMaxLatencyDuration: 3, // Maximum acceptable latency
          lowLatencyMode: true, // Enable low latency mode
          backBufferLength: 10, // Limit backward buffer
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
      responsive: true,
      fluid: true,
      controls: true,
      autoplay: false, // Change to false and manually play after setup
      preload: "auto",
      playbackRates: [1],
      inactivityTimeout: 0,
      loop: false,
      techOrder: ["html5"],
    });

    // Make sure we're using the correct URL format for the HLS stream
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const hlsUrl = `${protocol}//${hostname}:8000/live/${streamKey}/index.m3u8?_=${Date.now()}`;

    console.log("Attempting to play HLS stream:", hlsUrl);
    console.log("Stream key:", streamKey);
    console.log("Stream data:", stream);

    // Create a spinning loader to show while loading
    const videoContainer = document.querySelector(".video-container");
    const loader = document.createElement("div");
    loader.className = "video-loader";
    loader.innerHTML =
      '<div class="spinner"></div><p>Connecting to stream...</p>';
    videoContainer.appendChild(loader);

    // Add styles for loader if not already added
    if (!document.getElementById("loader-style")) {
      const style = document.createElement("style");
      style.id = "loader-style";
      style.innerHTML = `
        .video-loader {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background-color: rgba(0, 0, 0, 0.7);
          z-index: 100;
        }
        .spinner {
          border: 5px solid #f3f3f3;
          border-top: 5px solid #ff0000;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 2s linear infinite;
          margin-bottom: 15px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .video-loader p {
          color: white;
          font-size: 16px;
        }
        .video-end-message {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background-color: rgba(0, 0, 0, 0.7);
          z-index: 100;
          color: white;
          text-align: center;
        }
        .video-end-message h3 {
          margin-bottom: 15px;
          color: #ff0000;
        }
        .video-end-message p {
          margin-bottom: 20px;
        }
      `;
      document.head.appendChild(style);
    }

    // Check if stream is active according to the API
    if (!stream.isLive) {
      console.log("Stream is not live according to API, using test stream");

      // Remove the loader
      const loader = document.querySelector(".video-loader");
      if (loader) loader.remove();

      // Set flag that we're using test stream
      usingTestStream = true;

      // Use the test file
      player.src({
        src: testHlsUrl,
        type: "application/x-mpegURL",
      });

      // Manual play after source is loaded
      player.ready(() => {
        player.play().catch((error) => {
          console.log("Autoplay prevented by browser", error);
        });
      });

      // Show overlay message that we're using test stream
      const testMessage = document.createElement("div");
      testMessage.className = "test-stream-message";
      testMessage.innerHTML = `
        <div class="test-banner">Viewing Test Stream</div>
      `;
      videoContainer.appendChild(testMessage);

      // Add styles for test stream message
      const testStyle = document.createElement("style");
      testStyle.innerHTML = `
        .test-stream-message {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 100;
        }
        .test-banner {
          background-color: rgba(255, 0, 0, 0.7);
          color: white;
          padding: 5px 10px;
          border-radius: 5px;
          font-size: 14px;
        }
      `;
      document.head.appendChild(testStyle);

      return; // Skip the rest of the setup
    }

    // Function to test if file exists
    function testHlsFiles() {
      // Add a timeout to prevent infinite loader if stream doesn't load
      let streamCheckTimeout;

      // Function to show stream ended message
      function showStreamEndedMessage() {
        // Remove the loader if present
        const loader = document.querySelector(".video-loader");
        if (loader) loader.remove();

        // Add a "Stream ended" overlay
        const videoContainer = document.querySelector(".video-container");
        const endMessage = document.createElement("div");
        endMessage.className = "video-end-message";
        endMessage.innerHTML = `
          <h3>Stream Has Ended</h3>
          <p>The broadcaster has ended the stream.</p>
          <button id="refresh-player" class="btn">Refresh Player</button>
          <button id="watch-test" class="btn btn-primary">Watch Test Stream</button>
        `;
        videoContainer.appendChild(endMessage);

        // Add refresh button functionality
        document
          .getElementById("refresh-player")
          .addEventListener("click", () => {
            location.reload();
          });

        // Add watch test stream functionality
        document.getElementById("watch-test").addEventListener("click", () => {
          // Remove the ended message
          endMessage.remove();

          // Set flag that we're using test stream
          usingTestStream = true;

          // Use the test file
          player.src({
            src: testHlsUrl,
            type: "application/x-mpegURL",
          });

          // Manual play after source is loaded
          player.ready(() => {
            player.play().catch((error) => {
              console.log("Autoplay prevented by browser", error);
            });
          });

          // Show overlay message that we're using test stream
          const testMessage = document.createElement("div");
          testMessage.className = "test-stream-message";
          testMessage.innerHTML = `
              <div class="test-banner">Viewing Test Stream</div>
            `;
          videoContainer.appendChild(testMessage);
        });
      }

      // Set a timeout to handle case where stream doesn't load within 15 seconds
      streamCheckTimeout = setTimeout(() => {
        const loader = document.querySelector(".video-loader");
        if (loader) {
          console.log("Stream check timeout reached. Stream may have ended.");

          // Try one final check with server to see if stream is still live
          fetch(`/api/streams/${streamKey}`)
            .then((response) => response.json())
            .then((stream) => {
              if (!stream.isLive) {
                console.log("Stream is not live according to server API");
                showStreamEndedMessage();
              } else {
                // If stream is still live but not loading, show error message
                const errorMsg = document.createElement("div");
                errorMsg.className = "video-error";
                errorMsg.innerHTML = `
                  <h3>Stream Error</h3>
                  <p>The stream is live but could not be loaded. This may be because:</p>
                  <ul>
                    <li>The stream is experiencing technical difficulties</li>
                    <li>Your network connection is unstable</li>
                  </ul>
                  <button id="refresh-player" class="btn">Refresh Player</button>
                  <button id="watch-test" class="btn btn-primary">Watch Test Stream</button>
                `;

                // Remove the loader
                loader.remove();

                document
                  .querySelector(".video-container")
                  .appendChild(errorMsg);

                // Add refresh button functionality
                document
                  .getElementById("refresh-player")
                  .addEventListener("click", () => {
                    location.reload();
                  });

                // Add watch test stream functionality
                document
                  .getElementById("watch-test")
                  .addEventListener("click", () => {
                    // Remove the error message
                    errorMsg.remove();

                    // Set flag that we're using test stream
                    usingTestStream = true;

                    // Use the test file
                    player.src({
                      src: testHlsUrl,
                      type: "application/x-mpegURL",
                    });

                    // Manual play after source is loaded
                    player.ready(() => {
                      player.play().catch((error) => {
                        console.log("Autoplay prevented by browser", error);
                      });
                    });

                    // Show overlay message that we're using test stream
                    const testMessage = document.createElement("div");
                    testMessage.className = "test-stream-message";
                    testMessage.innerHTML = `
                      <div class="test-banner">Viewing Test Stream</div>
                    `;
                    videoContainer.appendChild(testMessage);
                  });
              }
            })
            .catch((error) => {
              console.error("Error checking stream status:", error);
              showStreamEndedMessage();
            });
        }
      }, 15000);

      // Check for the playlist file
      fetch(hlsUrl)
        .then((response) => {
          console.log(`HLS playlist fetch status: ${response.status}`);
          if (!response.ok) {
            // If 404, check if stream was ended recently
            if (response.status === 404) {
              console.error("HLS playlist not found or not accessible");

              // Check if stream is active according to server
              return fetch(`/api/streams/${streamKey}`)
                .then((response) => response.json())
                .then((stream) => {
                  if (!stream.isLive) {
                    console.log("Stream is not live according to server API");
                    clearTimeout(streamCheckTimeout);
                    showStreamEndedMessage();
                    return null;
                  }

                  // If still live but playlist missing, fall back to test file
                  console.log("Falling back to test HLS file");

                  // Try loading the test file we created
                  console.log("Trying test file:", testHlsUrl);

                  return fetch(testHlsUrl).then((testResponse) => {
                    if (!testResponse.ok) {
                      throw new Error("Test HLS playlist not available");
                    }
                    console.log("Test file available, using it instead");

                    // Set flag that we're using test stream
                    usingTestStream = true;

                    // Remove the loader
                    const loader = document.querySelector(".video-loader");
                    if (loader) loader.remove();

                    // Clear the timeout since we've loaded a file
                    clearTimeout(streamCheckTimeout);

                    // Use the test file
                    player.src({
                      src: testHlsUrl,
                      type: "application/x-mpegURL",
                    });

                    // Set playbackRates to 1 only to prevent speed changes
                    player.playbackRates([1]);

                    // Disable looping
                    player.loop(false);

                    // Manual play after source is loaded
                    player.ready(() => {
                      player.play().catch((error) => {
                        console.log("Autoplay prevented by browser", error);
                      });
                    });

                    // Show overlay message that we're using test stream
                    const testMessage = document.createElement("div");
                    testMessage.className = "test-stream-message";
                    testMessage.innerHTML = `
                        <div class="test-banner">Viewing Test Stream</div>
                      `;
                    videoContainer.appendChild(testMessage);

                    return null; // Skip the original file
                  });
                })
                .catch((apiError) => {
                  console.error("Error checking stream status:", apiError);

                  // Fall back to test file as last resort
                  console.log("Falling back to test HLS file");

                  console.log("Trying test file:", testHlsUrl);

                  return fetch(testHlsUrl).then((testResponse) => {
                    if (!testResponse.ok) {
                      throw new Error("Test HLS playlist not available");
                    }
                    console.log("Test file available, using it instead");

                    // Set flag that we're using test stream
                    usingTestStream = true;

                    // Remove the loader
                    const loader = document.querySelector(".video-loader");
                    if (loader) loader.remove();

                    // Clear the timeout since we've loaded a file
                    clearTimeout(streamCheckTimeout);

                    // Use the test file
                    player.src({
                      src: testHlsUrl,
                      type: "application/x-mpegURL",
                    });

                    // Set playbackRates to 1 only to prevent speed changes
                    player.playbackRates([1]);

                    // Disable looping
                    player.loop(false);

                    // Manual play after source is loaded
                    player.ready(() => {
                      player.play().catch((error) => {
                        console.log("Autoplay prevented by browser", error);
                      });
                    });

                    // Show overlay message that we're using test stream
                    const testMessage = document.createElement("div");
                    testMessage.className = "test-stream-message";
                    testMessage.innerHTML = `
                        <div class="test-banner">Viewing Test Stream</div>
                      `;
                    videoContainer.appendChild(testMessage);

                    return null; // Skip the original file
                  });
                });
            } else {
              console.error("HLS playlist not found or not accessible");
              console.log("Falling back to test HLS file");

              // Try loading the test file we created
              console.log("Trying test file:", testHlsUrl);

              return fetch(testHlsUrl)
                .then((testResponse) => {
                  if (!testResponse.ok) {
                    throw new Error("Test HLS playlist not available");
                  }
                  console.log("Test file available, using it instead");

                  // Set flag that we're using test stream
                  usingTestStream = true;

                  // Remove the loader
                  const loader = document.querySelector(".video-loader");
                  if (loader) loader.remove();

                  // Clear the timeout since we've loaded a file
                  clearTimeout(streamCheckTimeout);

                  // Use the test file
                  player.src({
                    src: testHlsUrl,
                    type: "application/x-mpegURL",
                  });

                  // Set playbackRates to 1 only to prevent speed changes
                  player.playbackRates([1]);

                  // Disable looping
                  player.loop(false);

                  // Manual play after source is loaded
                  player.ready(() => {
                    player.play().catch((error) => {
                      console.log("Autoplay prevented by browser", error);
                    });
                  });

                  // Show overlay message that we're using test stream
                  const testMessage = document.createElement("div");
                  testMessage.className = "test-stream-message";
                  testMessage.innerHTML = `
                    <div class="test-banner">Viewing Test Stream</div>
                  `;
                  videoContainer.appendChild(testMessage);

                  return null; // Skip the original file
                })
                .catch((testError) => {
                  console.error("Test file also not available:", testError);
                  throw new Error("HLS playlist not available");
                });
            }
          }
          return response.text();
        })
        .then((data) => {
          if (!data) return; // Skip if we're using the test file

          // Clear the timeout since we've loaded a file
          clearTimeout(streamCheckTimeout);

          console.log(
            "HLS playlist exists, first 100 chars:",
            data.substring(0, 100)
          );

          // Check if playlist has the EXT-X-ENDLIST tag which indicates a VOD/ended stream
          if (data.includes("#EXT-X-ENDLIST")) {
            console.log("Stream has ended (EXT-X-ENDLIST found in playlist)");

            // Show stream ended message if not a test stream
            if (!hlsUrl.includes("/test/")) {
              showStreamEndedMessage();
              return;
            }
          }

          // Check if playlist contains any segment references
          if (data.includes(".ts")) {
            console.log("HLS playlist contains segments, attempting to play");

            // Remove the loader
            const loader = document.querySelector(".video-loader");
            if (loader) loader.remove();

            // Set up HLS source with a cache-busting query parameter
            player.src({
              src: hlsUrl,
              type: "application/x-mpegURL",
            });

            // Set playbackRates to 1 only to prevent speed changes
            player.playbackRates([1]);

            // Disable looping
            player.loop(false);

            // Manual play after source is loaded
            player.ready(() => {
              player.play().catch((error) => {
                console.log("Autoplay prevented by browser", error);
              });
            });
          } else {
            console.warn(
              "HLS playlist exists but doesn't contain segments yet"
            );
            // Wait 2 seconds and try again
            setTimeout(testHlsFiles, 2000);
          }
        })
        .catch((error) => {
          console.error("Error checking HLS playlist:", error);

          // Check if stream is not live
          fetch(`/api/streams/${streamKey}`)
            .then((response) => response.json())
            .then((stream) => {
              if (!stream.isLive) {
                console.log("Stream is not live according to server API");
                showStreamEndedMessage();
              } else {
                // Retry after a delay only if stream is still live
                console.log("Retrying in 3 seconds...");
                setTimeout(testHlsFiles, 3000);
              }
            })
            .catch((err) => {
              // Retry after a delay if we can't check the stream status
              console.log("Retrying in 3 seconds...");
              setTimeout(testHlsFiles, 3000);
            });
        });
    }

    // Start testing for HLS files
    testHlsFiles();

    // Set up a periodic check for stream status
    const streamStatusInterval = setInterval(() => {
      // Only run check if player is initialized and loader is not visible
      if (player && !document.querySelector(".video-loader")) {
        fetch(`/api/streams/${streamKey}`)
          .then((response) => {
            if (!response.ok) {
              clearInterval(streamStatusInterval);
              return;
            }
            return response.json();
          })
          .then((stream) => {
            if (stream && !stream.isLive) {
              console.log("Stream is no longer live according to server API");
              handleStreamEnded();
              clearInterval(streamStatusInterval);
            }
          })
          .catch((error) => {
            console.error("Error checking stream status:", error);
          });
      }
    }, 30000); // Check every 30 seconds

    // Handle stalled playback (when video freezes but doesn't trigger error)
    player.on("stalled", () => {
      console.log("Playback stalled");

      // Set a timeout to check if stall persists
      const stalledTimeout = setTimeout(() => {
        // If we're still stalled after 10 seconds, check stream status
        if (player.paused() || player.readyState() < 3) {
          console.log(
            "Playback still stalled after timeout, checking stream status"
          );
          fetch(`/api/streams/${streamKey}`)
            .then((response) => response.json())
            .then((stream) => {
              if (!stream.isLive) {
                handleStreamEnded();
              } else {
                // If stream is live but playback is stalled, try reloading the source
                const currentTime = player.currentTime();
                player.src({
                  src: `${hlsUrl}?_=${Date.now()}`, // Add cache buster
                  type: "application/x-mpegURL",
                });
                player.load();
                player
                  .play()
                  .then(() => {
                    // Try to restore position if possible
                    if (currentTime > 0) {
                      player.currentTime(currentTime);
                    }
                  })
                  .catch((err) => {
                    console.error("Failed to restart playback:", err);
                  });
              }
            })
            .catch((error) => {
              console.error("Error checking stream status:", error);
            });
        }
      }, 10000); // 10 second timeout

      // Clear timeout if playback resumes
      player.one(["playing", "timeupdate"], () => {
        clearTimeout(stalledTimeout);
      });
    });

    // Add event listeners for player
    player.on("playing", () => {
      console.log("Stream is now playing");
      updateViewCount();

      // Remove any error messages if the stream starts playing
      const errorMsg = document.querySelector(".video-error");
      if (errorMsg) {
        errorMsg.remove();
      }

      // Remove the loader if still present
      const loader = document.querySelector(".video-loader");
      if (loader) loader.remove();
    });

    // Listen for specific player events
    player.on("waiting", () => {
      console.log("Player waiting for data");

      // Add a timeout to detect if player is stuck in waiting state
      const waitingTimeout = setTimeout(() => {
        console.log("Player stuck in waiting state");
        // Check if stream is still available
        fetch(hlsUrl + `?_=${Date.now()}`)
          .then((response) => {
            if (!response.ok) {
              // If playlist no longer available, stream has likely ended
              fetch(`/api/streams/${streamKey}`)
                .then((response) => response.json())
                .then((stream) => {
                  if (!stream.isLive) {
                    handleStreamEnded();
                  }
                })
                .catch((error) => {
                  console.error("Error checking stream status:", error);
                });
            }
          })
          .catch((error) => {
            console.error("Error checking HLS playlist:", error);
          });
      }, 10000); // 10 second timeout

      // Clear timeout if player starts playing again
      player.one("playing", () => {
        clearTimeout(waitingTimeout);
      });
    });

    // Add an error event listener with better error handling
    player.on("error", function () {
      const error = player.error();
      console.error("Video player error:", error);

      // Remove the loader if present
      const loader = document.querySelector(".video-loader");
      if (loader) loader.remove();

      // Check if error is due to stream ending
      if (error.code === 4 || error.code === 2) {
        fetch(`/api/streams/${streamKey}`)
          .then((response) => response.json())
          .then((stream) => {
            if (!stream.isLive) {
              // Stream has ended, show appropriate message
              handleStreamEnded();
              return;
            }

            // Otherwise show generic error
            showErrorMessage(error);
          })
          .catch((err) => {
            // Show generic error
            showErrorMessage(error);
          });
      } else {
        // Show generic error for other error types
        showErrorMessage(error);
      }
    });

    // Function to show error message
    function showErrorMessage(error) {
      const errorMsg = document.createElement("div");
      errorMsg.className = "video-error";
      errorMsg.innerHTML = `
        <h3>Stream Error</h3>
        <p>The stream could not be loaded. This may be because:</p>
        <ul>
          <li>The stream has not started yet</li>
          <li>FFmpeg is not installed on the server</li>
          <li>There was a network error</li>
        </ul>
        <p>Error code: ${error.code}</p>
        <p>Try refreshing the page after ensuring your stream is active.</p>
        <button id="refresh-player" class="btn">Refresh Player</button>
      `;
      document.querySelector(".video-container").appendChild(errorMsg);

      // Add refresh button functionality
      document
        .getElementById("refresh-player")
        .addEventListener("click", () => {
          location.reload();
        });
    }

    // Add a listener for the end of the video to prevent looping
    player.on("ended", function () {
      console.log("Playback ended");
      // Prevent auto-looping by making sure we stay at the end
      const time = player.duration() - 0.1;
      player.currentTime(time);

      // Add a "Stream ended" overlay
      const videoContainer = document.querySelector(".video-container");
      const endMessage = document.createElement("div");
      endMessage.className = "video-end-message";
      endMessage.innerHTML = `
        <h3>Stream Playback Ended</h3>
        <p>The stream has finished playing.</p>
        <button id="replay-stream" class="btn">Replay Stream</button>
      `;
      videoContainer.appendChild(endMessage);

      // Add replay button functionality
      document.getElementById("replay-stream").addEventListener("click", () => {
        player.currentTime(0);
        player.play();
        endMessage.remove();
      });
    });
  }

  // Initialize stream data
  async function initializeStream() {
    try {
      const response = await fetch(`/api/streams/${streamKey}`);

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.error || "Stream not found"}`);
        window.location.href = "/";
        return;
      }

      const stream = await response.json();

      // Update page with stream info
      streamTitle.textContent = stream.title;
      streamDescription.textContent =
        stream.description || "No description provided";
      streamUsername.textContent = stream.username;
      viewCount.textContent = `${stream.viewCount} viewers`;

      // Set up video player
      setupVideoPlayer(stream);

      // Start polling for view count updates
      setInterval(fetchStreamInfo, 10000);

      // Prompt for username if not set
      if (!username) {
        promptForUsername();
      }
    } catch (error) {
      console.error("Error initializing stream:", error);
      alert("Error loading stream. Please try again.");
    }
  }

  // Fetch updated stream info
  async function fetchStreamInfo() {
    try {
      const response = await fetch(`/api/streams/${streamKey}`);

      if (!response.ok) {
        return;
      }

      const stream = await response.json();

      // Update view count
      viewCount.textContent = `${stream.viewCount} viewers`;

      // Check if stream is still live
      if (!stream.isLive) {
        handleStreamEnded();
      }
    } catch (error) {
      console.error("Error fetching stream info:", error);
    }
  }

  // Update view count
  async function updateViewCount() {
    try {
      await fetch(`/api/streams/${streamKey}/view`, {
        method: "PUT",
      });
    } catch (error) {
      console.error("Error updating view count:", error);
    }
  }

  // Handle stream ended
  function handleStreamEnded() {
    console.log("Stream has ended, updating UI");

    // Remove any existing loader or error messages
    const loader = document.querySelector(".video-loader");
    if (loader) loader.remove();

    const errorMsg = document.querySelector(".video-error");
    if (errorMsg) errorMsg.remove();

    // Dispose of the player if it exists
    if (player) {
      player.pause();
      player.dispose();
      player = null;
    }

    const videoContainer = document.querySelector(".video-container");
    videoContainer.innerHTML = `
      <div class="stream-ended">
        <h3>Stream Has Ended</h3>
        <p>The broadcaster has ended the stream.</p>
        <div class="stream-ended-actions">
          <a href="/" class="btn">Back to Home</a>
          <button id="refresh-stream" class="btn btn-primary">Refresh</button>
        </div>
      </div>
    `;

    // Add refresh button functionality
    document.getElementById("refresh-stream").addEventListener("click", () => {
      location.reload();
    });

    // Add some styling for the stream ended screen
    const style = document.createElement("style");
    if (!document.getElementById("stream-ended-style")) {
      style.id = "stream-ended-style";
      style.innerHTML = `
        .stream-ended {
          background-color: rgba(0, 0, 0, 0.8);
          padding: 2rem;
          border-radius: 8px;
          text-align: center;
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100%;
        }
        .stream-ended h3 {
          color: #ff4c4c;
          font-size: 1.8rem;
          margin-bottom: 1rem;
        }
        .stream-ended p {
          margin-bottom: 1.5rem;
          font-size: 1.2rem;
        }
        .stream-ended-actions {
          display: flex;
          gap: 1rem;
        }
        .btn-primary {
          background-color: #ff4c4c;
          color: white;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Prompt for username
  function promptForUsername() {
    username = prompt("Please enter a username for chat:") || "Anonymous";
    localStorage.setItem("username", username);
  }

  // Send chat message
  function sendChatMessage() {
    const message = chatInput.value.trim();

    if (!message) return;

    // In a real app, you would send this to a WebSocket server
    // For this demo, we'll just add it to the chat locally
    appendChatMessage(username, message);

    // Clear input
    chatInput.value = "";
  }

  // Append chat message to chat
  function appendChatMessage(username, message) {
    const messageEl = document.createElement("div");
    messageEl.className = "chat-message";
    messageEl.innerHTML = `
      <span class="chat-username">${username}:</span>
      <span class="chat-text">${message}</span>
    `;

    chatMessages.appendChild(messageEl);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Event listeners
  sendMessageBtn.addEventListener("click", sendChatMessage);

  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendChatMessage();
    }
  });
});
