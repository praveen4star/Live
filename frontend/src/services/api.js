import axios from "axios";

// Create an axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor to include auth token in requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Unauthorized, clear token and redirect to login
      if (error.response.status === 401) {
        localStorage.removeItem("auth_token");
        window.location = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// API functions for streams
const streamsApi = {
  // Get all streams
  getStreams: () => {
    return api.get("/streams");
  },

  // Get a specific stream
  getStream: (streamId) => {
    return api.get(`/streams/${streamId}`);
  },

  // Create a new stream
  createStream: (streamData) => {
    return api.post("/streams", streamData);
  },

  // Get stream key
  getStreamKey: (streamId) => {
    return api.get(`/streams/${streamId}/key`);
  },

  // Get playback URLs
  getPlaybackUrls: (streamId) => {
    return api.get(`/streams/${streamId}/playback`);
  },

  // Delete a stream
  deleteStream: (streamId) => {
    return api.delete(`/streams/${streamId}`);
  },
};

// API functions for VOD
const vodApi = {
  // Get all VODs
  getVods: () => {
    return api.get("/vod");
  },

  // Get a specific VOD
  getVod: (vodId) => {
    return api.get(`/vod/${vodId}`);
  },
};

// API functions for authentication
const authApi = {
  // Generate a stream token
  getStreamToken: (streamId, type) => {
    return api.post("/auth/stream-token", { streamId, type });
  },

  // Validate a token
  validateToken: (token) => {
    return api.post("/auth/validate-token", { token });
  },
};

export { api, streamsApi, vodApi, authApi };
