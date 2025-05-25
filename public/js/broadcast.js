document.addEventListener("DOMContentLoaded", () => {
  const streamForm = document.getElementById("stream-form");
  const streamInfo = document.getElementById("stream-info");
  const streamStatus = document.getElementById("stream-status");
  const streamKey = document.getElementById("stream-key");
  const showKeyBtn = document.getElementById("show-key");
  const copyKeyBtn = document.getElementById("copy-key");
  const copyUrlBtn = document.getElementById("copy-url");
  const endStreamBtn = document.getElementById("end-stream");

  let activeStreamKey = null;
  let statusCheckInterval = null;

  // Show/hide stream key
  showKeyBtn.addEventListener("click", () => {
    const type = streamKey.type === "password" ? "text" : "password";
    streamKey.type = type;
    showKeyBtn.innerHTML =
      type === "password"
        ? '<i class="fas fa-eye"></i>'
        : '<i class="fas fa-eye-slash"></i>';
  });

  // Copy stream key to clipboard
  copyKeyBtn.addEventListener("click", () => {
    streamKey.select();
    document.execCommand("copy");
    alert("Stream key copied to clipboard");
  });

  // Copy RTMP URL to clipboard
  copyUrlBtn.addEventListener("click", () => {
    const rtmpUrl = document.getElementById("rtmp-url");
    rtmpUrl.select();
    document.execCommand("copy");
    alert("RTMP URL copied to clipboard");
  });

  // Create a new stream
  streamForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const title = document.getElementById("title").value;
    const description = document.getElementById("description").value;

    // Generate a random stream key
    const randomStreamKey = generateStreamKey();

    try {
      const response = await fetch("/api/streams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          title,
          description,
          streamKey: randomStreamKey,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        activeStreamKey = data.streamKey;
        streamKey.value = activeStreamKey;

        // Show stream info and hide form
        streamForm.parentElement.classList.add("hidden");
        streamInfo.classList.remove("hidden");

        // Start checking stream status
        startStatusCheck();
      } else {
        alert(`Error: ${data.error || "Failed to create stream"}`);
      }
    } catch (error) {
      console.error("Error creating stream:", error);
      alert("Error creating stream. Please try again.");
    }
  });

  // End the stream
  endStreamBtn.addEventListener("click", async () => {
    if (!activeStreamKey) return;

    try {
      const response = await fetch(`/api/streams/${activeStreamKey}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Reset UI
        streamForm.reset();
        streamForm.parentElement.classList.remove("hidden");
        streamInfo.classList.add("hidden");
        streamStatus.textContent = "Not Live";
        streamStatus.style.color = "";

        // Clear interval
        clearInterval(statusCheckInterval);

        // Reset active stream key
        activeStreamKey = null;

        alert("Stream ended successfully");
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || "Failed to end stream"}`);
      }
    } catch (error) {
      console.error("Error ending stream:", error);
      alert("Error ending stream. Please try again.");
    }
  });

  // Generate a random stream key
  function generateStreamKey() {
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 16; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  }

  // Start checking stream status
  function startStatusCheck() {
    // Check immediately
    checkStreamStatus();

    // Then check every 5 seconds
    statusCheckInterval = setInterval(checkStreamStatus, 5000);
  }

  // Check if stream is live
  async function checkStreamStatus() {
    if (!activeStreamKey) return;

    try {
      const response = await fetch(`/api/streams/${activeStreamKey}`);
      const data = await response.json();

      if (response.ok) {
        if (data.isLive) {
          streamStatus.textContent = "LIVE";
          streamStatus.style.color = "#ff0000";
        } else {
          streamStatus.textContent = "Not Live";
          streamStatus.style.color = "";
        }
      }
    } catch (error) {
      console.error("Error checking stream status:", error);
    }
  }
});
