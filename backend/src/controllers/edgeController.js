const express = require("express");
const router = express.Router();

// In-memory storage for edge servers
// In production, use Redis or a database
const edgeServers = new Map();
const streamRouting = new Map(); // Maps stream IDs to edge servers

/**
 * Edge Server Registration
 * POST /api/edge/register
 */
router.post("/register", (req, res) => {
  try {
    const { serverId, serverName, host, ports, capacity, region } = req.body;

    if (!serverId || !serverName || !host || !ports) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: serverId, serverName, host, ports",
      });
    }

    const edgeServer = {
      serverId,
      serverName,
      host,
      ports: {
        hls: ports.hls || 8080,
        webrtc: ports.webrtc || 3333,
        api: ports.api || 8081,
        ...ports,
      },
      capacity: capacity || 100,
      region: region || "default",
      status: "active",
      activeStreams: 0,
      registeredAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      load: 0,
    };

    edgeServers.set(serverId, edgeServer);

    console.log(`Edge server registered: ${serverId} (${serverName})`);

    res.json({
      success: true,
      message: "Edge server registered successfully",
      server: edgeServer,
    });
  } catch (error) {
    console.error("Edge server registration error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to register edge server",
    });
  }
});

/**
 * Edge Server Heartbeat
 * POST /api/edge/heartbeat
 */
router.post("/heartbeat", (req, res) => {
  try {
    const { serverId, activeStreams, load, status } = req.body;

    if (!serverId) {
      return res.status(400).json({
        success: false,
        error: "serverId is required",
      });
    }

    const server = edgeServers.get(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        error: "Edge server not found",
      });
    }

    // Update server status
    server.lastHeartbeat = new Date().toISOString();
    server.activeStreams = activeStreams || server.activeStreams;
    server.load = load || server.load;
    server.status = status || server.status;

    edgeServers.set(serverId, server);

    res.json({
      success: true,
      message: "Heartbeat received",
      server: server,
    });
  } catch (error) {
    console.error("Edge server heartbeat error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process heartbeat",
    });
  }
});

/**
 * Get Available Edge Servers
 * GET /api/edge/servers
 */
router.get("/servers", (req, res) => {
  try {
    const { region, includeInactive } = req.query;

    let servers = Array.from(edgeServers.values());

    // Filter by region if specified
    if (region) {
      servers = servers.filter((server) => server.region === region);
    }

    // Filter out inactive servers unless requested
    if (!includeInactive) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      servers = servers.filter(
        (server) =>
          server.status === "active" &&
          new Date(server.lastHeartbeat) > fiveMinutesAgo
      );
    }

    // Sort by load (ascending) for load balancing
    servers.sort((a, b) => a.load - b.load);

    res.json({
      success: true,
      servers: servers,
      count: servers.length,
    });
  } catch (error) {
    console.error("Get edge servers error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get edge servers",
    });
  }
});

/**
 * Get Best Edge Server for Stream
 * GET /api/edge/best-server/:streamId
 */
router.get("/best-server/:streamId", (req, res) => {
  try {
    const { streamId } = req.params;
    const { region, preferredServer } = req.query;

    // Check if stream is already routed to an edge server
    const existingRoute = streamRouting.get(streamId);
    if (existingRoute) {
      const server = edgeServers.get(existingRoute.serverId);
      if (server && server.status === "active") {
        return res.json({
          success: true,
          server: server,
          message: "Stream already routed to this server",
        });
      } else {
        // Remove stale routing
        streamRouting.delete(streamId);
      }
    }

    // Get available servers
    let servers = Array.from(edgeServers.values());

    // Filter active servers
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    servers = servers.filter(
      (server) =>
        server.status === "active" &&
        new Date(server.lastHeartbeat) > fiveMinutesAgo
    );

    // Filter by region if specified
    if (region) {
      servers = servers.filter((server) => server.region === region);
    }

    // Check for preferred server
    if (preferredServer) {
      const preferred = servers.find(
        (server) => server.serverId === preferredServer
      );
      if (preferred && preferred.load < 80) {
        // Don't use if over 80% load
        return res.json({
          success: true,
          server: preferred,
          message: "Using preferred server",
        });
      }
    }

    if (servers.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No available edge servers found",
      });
    }

    // Load balancing algorithm: choose server with lowest load
    const bestServer = servers.reduce((best, current) => {
      if (current.load < best.load) return current;
      if (
        current.load === best.load &&
        current.activeStreams < best.activeStreams
      )
        return current;
      return best;
    });

    // Route stream to selected server
    streamRouting.set(streamId, {
      serverId: bestServer.serverId,
      routedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      server: bestServer,
      message: "Best server selected for stream",
    });
  } catch (error) {
    console.error("Get best server error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get best server",
    });
  }
});

/**
 * Route Stream to Edge Server
 * POST /api/edge/route-stream
 */
router.post("/route-stream", (req, res) => {
  try {
    const { streamId, serverId, force } = req.body;

    if (!streamId || !serverId) {
      return res.status(400).json({
        success: false,
        error: "streamId and serverId are required",
      });
    }

    const server = edgeServers.get(serverId);
    if (!server) {
      return res.status(404).json({
        success: false,
        error: "Edge server not found",
      });
    }

    // Check if stream is already routed
    const existingRoute = streamRouting.get(streamId);
    if (existingRoute && !force) {
      return res.status(409).json({
        success: false,
        error: "Stream already routed to another server",
        currentServer: existingRoute.serverId,
      });
    }

    // Route stream
    streamRouting.set(streamId, {
      serverId: serverId,
      routedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Stream routed successfully",
      streamId: streamId,
      serverId: serverId,
    });
  } catch (error) {
    console.error("Route stream error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to route stream",
    });
  }
});

/**
 * Remove Stream Routing
 * DELETE /api/edge/route-stream/:streamId
 */
router.delete("/route-stream/:streamId", (req, res) => {
  try {
    const { streamId } = req.params;

    const existed = streamRouting.has(streamId);
    streamRouting.delete(streamId);

    res.json({
      success: true,
      message: existed ? "Stream routing removed" : "Stream was not routed",
      streamId: streamId,
    });
  } catch (error) {
    console.error("Remove stream routing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to remove stream routing",
    });
  }
});

/**
 * Get Stream Routing Information
 * GET /api/edge/stream-routing/:streamId
 */
router.get("/stream-routing/:streamId", (req, res) => {
  try {
    const { streamId } = req.params;

    const routing = streamRouting.get(streamId);
    if (!routing) {
      return res.status(404).json({
        success: false,
        error: "Stream routing not found",
      });
    }

    const server = edgeServers.get(routing.serverId);

    res.json({
      success: true,
      routing: {
        streamId: streamId,
        serverId: routing.serverId,
        routedAt: routing.routedAt,
        server: server,
      },
    });
  } catch (error) {
    console.error("Get stream routing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get stream routing",
    });
  }
});

/**
 * Edge Server Statistics
 * GET /api/edge/stats
 */
router.get("/stats", (req, res) => {
  try {
    const totalServers = edgeServers.size;
    const activeServers = Array.from(edgeServers.values()).filter((server) => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      return (
        server.status === "active" &&
        new Date(server.lastHeartbeat) > fiveMinutesAgo
      );
    }).length;

    const totalStreams = streamRouting.size;
    const totalCapacity = Array.from(edgeServers.values()).reduce(
      (sum, server) => sum + server.capacity,
      0
    );
    const totalActiveStreams = Array.from(edgeServers.values()).reduce(
      (sum, server) => sum + server.activeStreams,
      0
    );

    const regions = {};
    edgeServers.forEach((server) => {
      if (!regions[server.region]) {
        regions[server.region] = { servers: 0, activeStreams: 0 };
      }
      regions[server.region].servers++;
      regions[server.region].activeStreams += server.activeStreams;
    });

    res.json({
      success: true,
      stats: {
        totalServers,
        activeServers,
        totalStreams,
        totalCapacity,
        totalActiveStreams,
        utilization:
          totalCapacity > 0
            ? ((totalActiveStreams / totalCapacity) * 100).toFixed(2)
            : 0,
        regions,
      },
    });
  } catch (error) {
    console.error("Get edge stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get edge statistics",
    });
  }
});

/**
 * Cleanup expired heartbeats
 * This should be called periodically
 */
function cleanupExpiredServers() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  edgeServers.forEach((server, serverId) => {
    if (new Date(server.lastHeartbeat) < tenMinutesAgo) {
      console.log(`Removing expired edge server: ${serverId}`);
      edgeServers.delete(serverId);

      // Remove routing to this server
      streamRouting.forEach((routing, streamId) => {
        if (routing.serverId === serverId) {
          streamRouting.delete(streamId);
        }
      });
    }
  });
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredServers, 5 * 60 * 1000);

module.exports = router;
