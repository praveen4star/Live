import axios from "axios";

// Create an axios instance with default config and no auth
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// API functions for streams - without authentication
const streamsApi = {
  // Get all streams
  getStreams: () => {
    return api.get("/streams");
  },

  // Get a specific stream
  getStream: (streamId) => {
    return api.get(`/streams/${streamId}`);
  },

  // Create a new stream - no auth required
  createStream: (streamData) => {
    return api.post("/streams", streamData);
  },

  // Delete a stream
  deleteStream: (streamId) => {
    return api.delete(`/streams/${streamId}`);
  },
};

export { api, streamsApi };
