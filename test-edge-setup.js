#!/usr/bin/env node

const fetch = require("node-fetch");

// Configuration
const BACKEND_URL = "http://localhost:3001";
const ORIGIN_URL = "http://localhost:8080";
const EDGE1_URL = "http://localhost:8090";
const EDGE2_URL = "http://localhost:8091";

// Test data
const TEST_STREAM_ID = "test-stream-" + Date.now();
const TEST_SERVERS = [
  {
    serverId: "edge-1-local",
    serverName: "Edge Server 1 Local",
    host: "localhost",
    ports: {
      hls: 8090,
      webrtc: 3343,
      api: 8082,
    },
    capacity: 100,
    region: "local",
  },
  {
    serverId: "edge-2-local",
    serverName: "Edge Server 2 Local",
    host: "localhost",
    ports: {
      hls: 8091,
      webrtc: 3353,
      api: 8083,
    },
    capacity: 150,
    region: "local",
  },
];

// Utility functions
function log(message, type = "info") {
  const timestamp = new Date().toISOString();
  const prefix = type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️";
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function logSection(title) {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      timeout: 5000,
      ...options,
    });

    const data = await response.json();
    return { success: response.ok, status: response.status, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test functions
async function testBackendHealth() {
  logSection("Testing Backend Health");

  const result = await makeRequest(`${BACKEND_URL}/health`);

  if (result.success) {
    log("Backend health check passed", "success");
    log(`Services: ${JSON.stringify(result.data.services)}`);
    return true;
  } else {
    log(
      `Backend health check failed: ${result.error || result.status}`,
      "error"
    );
    return false;
  }
}

async function testEdgeServerRegistration() {
  logSection("Testing Edge Server Registration");

  let allSuccessful = true;

  for (const server of TEST_SERVERS) {
    log(`Registering ${server.serverName}...`);

    const result = await makeRequest(`${BACKEND_URL}/api/edge/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(server),
    });

    if (result.success) {
      log(`${server.serverName} registered successfully`, "success");
    } else {
      log(
        `Failed to register ${server.serverName}: ${
          result.error || result.data?.error
        }`,
        "error"
      );
      allSuccessful = false;
    }
  }

  return allSuccessful;
}

async function testEdgeServerHeartbeat() {
  logSection("Testing Edge Server Heartbeat");

  let allSuccessful = true;

  for (const server of TEST_SERVERS) {
    log(`Sending heartbeat for ${server.serverName}...`);

    const heartbeatData = {
      serverId: server.serverId,
      activeStreams: Math.floor(Math.random() * 50),
      load: Math.random() * 100,
      status: "active",
    };

    const result = await makeRequest(`${BACKEND_URL}/api/edge/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(heartbeatData),
    });

    if (result.success) {
      log(`Heartbeat sent for ${server.serverName}`, "success");
    } else {
      log(
        `Failed to send heartbeat for ${server.serverName}: ${
          result.error || result.data?.error
        }`,
        "error"
      );
      allSuccessful = false;
    }
  }

  return allSuccessful;
}

async function testGetAvailableServers() {
  logSection("Testing Get Available Servers");

  const result = await makeRequest(`${BACKEND_URL}/api/edge/servers`);

  if (result.success) {
    log(`Found ${result.data.count} available servers`, "success");
    result.data.servers.forEach((server) => {
      log(
        `  - ${server.serverName} (${server.serverId}): Load ${server.load}%`
      );
    });
    return true;
  } else {
    log(
      `Failed to get available servers: ${result.error || result.data?.error}`,
      "error"
    );
    return false;
  }
}

async function testBestServerSelection() {
  logSection("Testing Best Server Selection");

  const result = await makeRequest(
    `${BACKEND_URL}/api/edge/best-server/${TEST_STREAM_ID}`
  );

  if (result.success) {
    log(`Best server selected: ${result.data.server.serverName}`, "success");
    log(`Server details: ${JSON.stringify(result.data.server, null, 2)}`);
    return result.data.server;
  } else {
    log(
      `Failed to get best server: ${result.error || result.data?.error}`,
      "error"
    );
    return null;
  }
}

async function testStreamRouting() {
  logSection("Testing Stream Routing");

  // Route to first server
  const routeData = {
    streamId: TEST_STREAM_ID,
    serverId: TEST_SERVERS[0].serverId,
  };

  const routeResult = await makeRequest(
    `${BACKEND_URL}/api/edge/route-stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(routeData),
    }
  );

  if (routeResult.success) {
    log(`Stream routed to ${TEST_SERVERS[0].serverName}`, "success");
  } else {
    log(
      `Failed to route stream: ${routeResult.error || routeResult.data?.error}`,
      "error"
    );
    return false;
  }

  // Get routing information
  const routingResult = await makeRequest(
    `${BACKEND_URL}/api/edge/stream-routing/${TEST_STREAM_ID}`
  );

  if (routingResult.success) {
    log(`Stream routing info retrieved`, "success");
    log(`Routed to: ${routingResult.data.routing.server.serverName}`);
  } else {
    log(
      `Failed to get routing info: ${
        routingResult.error || routingResult.data?.error
      }`,
      "error"
    );
    return false;
  }

  return true;
}

async function testEdgeStatistics() {
  logSection("Testing Edge Statistics");

  const result = await makeRequest(`${BACKEND_URL}/api/edge/stats`);

  if (result.success) {
    log("Edge statistics retrieved successfully", "success");
    log(`Total servers: ${result.data.stats.totalServers}`);
    log(`Active servers: ${result.data.stats.activeServers}`);
    log(`Total streams: ${result.data.stats.totalStreams}`);
    log(`Utilization: ${result.data.stats.utilization}%`);
    return true;
  } else {
    log(
      `Failed to get edge statistics: ${result.error || result.data?.error}`,
      "error"
    );
    return false;
  }
}

async function testStreamAvailability() {
  logSection("Testing Stream Availability");

  const servers = [
    { name: "Origin", url: ORIGIN_URL },
    { name: "Edge 1", url: EDGE1_URL },
    { name: "Edge 2", url: EDGE2_URL },
  ];

  for (const server of servers) {
    log(`Testing ${server.name} server availability...`);

    const testUrl = `${server.url}/app/${TEST_STREAM_ID}/llhls.m3u8`;
    const result = await makeRequest(testUrl, { method: "HEAD" });

    if (result.success || result.status === 404) {
      log(`${server.name} server is reachable (${result.status})`, "success");
    } else {
      log(
        `${server.name} server is not reachable: ${
          result.error || result.status
        }`,
        "error"
      );
    }
  }

  return true;
}

async function testCleanup() {
  logSection("Testing Cleanup");

  // Remove stream routing
  const result = await makeRequest(
    `${BACKEND_URL}/api/edge/route-stream/${TEST_STREAM_ID}`,
    {
      method: "DELETE",
    }
  );

  if (result.success) {
    log("Stream routing removed successfully", "success");
    return true;
  } else {
    log(
      `Failed to remove stream routing: ${result.error || result.data?.error}`,
      "error"
    );
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log("🚀 Starting Edge Server Tests");
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Test Stream ID: ${TEST_STREAM_ID}`);

  const tests = [
    { name: "Backend Health", fn: testBackendHealth },
    { name: "Edge Server Registration", fn: testEdgeServerRegistration },
    { name: "Edge Server Heartbeat", fn: testEdgeServerHeartbeat },
    { name: "Get Available Servers", fn: testGetAvailableServers },
    { name: "Best Server Selection", fn: testBestServerSelection },
    { name: "Stream Routing", fn: testStreamRouting },
    { name: "Edge Statistics", fn: testEdgeStatistics },
    { name: "Stream Availability", fn: testStreamAvailability },
    { name: "Cleanup", fn: testCleanup },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      log(`Test "${test.name}" threw an error: ${error.message}`, "error");
      failed++;
    }

    // Wait a bit between tests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  logSection("Test Results");
  log(`Total tests: ${tests.length}`);
  log(`Passed: ${passed}`, "success");
  log(`Failed: ${failed}`, failed > 0 ? "error" : "success");

  if (failed === 0) {
    log("🎉 All tests passed!", "success");
  } else {
    log(`❌ ${failed} test(s) failed`, "error");
  }

  return failed === 0;
}

// Additional utility functions for manual testing
function printUsage() {
  console.log("\nUsage:");
  console.log("  node test-edge-setup.js                 # Run all tests");
  console.log(
    "  node test-edge-setup.js --register      # Register edge servers"
  );
  console.log("  node test-edge-setup.js --heartbeat     # Send heartbeat");
  console.log("  node test-edge-setup.js --servers       # List servers");
  console.log("  node test-edge-setup.js --stats         # Show statistics");
  console.log("  node test-edge-setup.js --route <id>    # Route stream");
  console.log("  node test-edge-setup.js --help          # Show this help");
}

// Command line handling
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    printUsage();
    return;
  }

  if (args.includes("--register")) {
    await testEdgeServerRegistration();
    return;
  }

  if (args.includes("--heartbeat")) {
    await testEdgeServerHeartbeat();
    return;
  }

  if (args.includes("--servers")) {
    await testGetAvailableServers();
    return;
  }

  if (args.includes("--stats")) {
    await testEdgeStatistics();
    return;
  }

  if (args.includes("--route")) {
    const streamId = args[args.indexOf("--route") + 1] || TEST_STREAM_ID;
    await testBestServerSelection();
    return;
  }

  // Run all tests by default
  const success = await runTests();
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  testBackendHealth,
  testEdgeServerRegistration,
  testEdgeServerHeartbeat,
  testGetAvailableServers,
  testBestServerSelection,
  testStreamRouting,
  testEdgeStatistics,
  testStreamAvailability,
  testCleanup,
};
