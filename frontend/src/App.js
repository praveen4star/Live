import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import VideoPlayer from "./components/VideoPlayer";

function StreamPage() {
  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      <h1>Live Streaming Platform</h1>
      <p>
        Generate a stream ID and key, then use them to stream and watch content.
      </p>

      <VideoPlayer />
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<StreamPage />} />
          {/* No authentication routes needed anymore */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
