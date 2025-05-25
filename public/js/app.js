document.addEventListener("DOMContentLoaded", () => {
  const liveStreamsContainer = document.getElementById(
    "live-streams-container"
  );

  // Function to fetch all active streams
  async function fetchStreams() {
    try {
      const response = await fetch("/api/streams");
      const data = await response.json();

      if (data.streams && data.streams.length > 0) {
        // Remove placeholder if streams exist
        const placeholder = document.querySelector(".stream-placeholder");
        if (placeholder) {
          placeholder.remove();
        }

        // Render each stream
        data.streams.forEach((stream) => {
          if (stream.isLive) {
            renderStreamCard(stream);
          }
        });
      }
    } catch (error) {
      console.error("Error fetching streams:", error);
    }
  }

  // Function to render a stream card
  function renderStreamCard(stream) {
    // Check if stream card already exists
    const existingCard = document.getElementById(`stream-${stream.id}`);
    if (existingCard) {
      // Update view count if card exists
      const viewerCount = existingCard.querySelector(".viewer-count");
      if (viewerCount) {
        viewerCount.textContent = `${stream.viewCount} viewers`;
      }
      return;
    }

    // Create new stream card
    const streamCard = document.createElement("div");
    streamCard.className = "stream-card";
    streamCard.id = `stream-${stream.id}`;

    // Thumbnail with placeholder image
    const thumbnailUrl = `/thumbnails/${stream.streamKey}.png`;

    streamCard.innerHTML = `
            <div class="stream-thumbnail">
                <img src="${thumbnailUrl}" onerror="this.src='https://via.placeholder.com/320x180?text=Live+Stream'" alt="${stream.title}">
                <div class="live-badge">LIVE</div>
                <div class="viewer-count">${stream.viewCount} viewers</div>
            </div>
            <div class="stream-info">
                <h3 class="stream-title">${stream.title}</h3>
                <p class="stream-username">${stream.username}</p>
            </div>
        `;

    // Add click event to navigate to stream
    streamCard.addEventListener("click", () => {
      window.location.href = `/watch.html?key=${stream.streamKey}`;
    });

    liveStreamsContainer.appendChild(streamCard);
  }

  // Initial fetch
  fetchStreams();

  // Refresh streams every 30 seconds
  setInterval(fetchStreams, 30000);
});
