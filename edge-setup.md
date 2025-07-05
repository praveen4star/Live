# OvenMediaEngine Edge Server Setup

This document provides comprehensive instructions for setting up and configuring edge servers with OvenMediaEngine for distributed streaming.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Origin Server │    │   Edge Server 1 │    │   Edge Server 2 │
│                 │    │                 │    │                 │
│ • RTMP Ingestion│    │ • Stream Relay  │    │ • Stream Relay  │
│ • Transcoding   │    │ • Viewer Serving│    │ • Viewer Serving│
│ • Authentication│    │ • Load Balancing│    │ • Load Balancing│
│ • Recording     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Redis Store   │
                    │                 │
                    │ • Origin Map    │
                    │ • Server Status │
                    │ • Stream Routing│
                    └─────────────────┘
```

## Quick Start

### 1. Start the Complete System

```bash
# Clone the repository
git clone <your-repo-url>
cd Live-v4

# Start all services (Origin, Edge servers, Redis, Backend, Frontend)
docker-compose up -d

# Check service status
docker-compose ps
```

### 2. Verify Edge Server Setup

```bash
# Check if all servers are running
curl http://localhost:3001/api/edge/servers

# Check edge server statistics
curl http://localhost:3001/api/edge/stats
```

### 3. Test Stream Distribution

1. **Start a stream** using OBS or FFmpeg to the origin server:

   ```
   RTMP URL: rtmp://localhost:1935/app
   Stream Key: your-stream-id?token=your-stream-key
   ```

2. **Play the stream** from different edge servers:
   - Origin: http://localhost:8080/app/your-stream-id/llhls.m3u8
   - Edge 1: http://localhost:8090/app/your-stream-id/llhls.m3u8
   - Edge 2: http://localhost:8091/app/your-stream-id/llhls.m3u8

## Detailed Configuration

### Origin Server Configuration

The origin server handles:

- RTMP stream ingestion
- Stream authentication
- Video transcoding
- Stream recording
- OVT publishing to edge servers

**Key configuration in `ome-config/Origin-Server.xml`:**

```xml
<Publishers>
  <!-- OVT Publisher for edge server communication -->
  <OVT>
    <Enable>true</Enable>
    <Port>9000</Port>
    <WorkerCount>1</WorkerCount>
  </OVT>
</Publishers>
```

### Edge Server Configuration

Edge servers handle:

- Stream relay from origin via OVT
- Viewer connections (HLS/WebRTC)
- Load balancing
- Regional distribution

**Key configuration in `ome-config/Edge-Server.xml`:**

```xml
<Providers>
  <!-- OVT Provider to pull streams from origin -->
  <OVT>
    <Enable>true</Enable>
    <Port>9000</Port>
    <WorkerCount>1</WorkerCount>
  </OVT>
</Providers>

<!-- Origin Map Store for Edge Server Discovery -->
<OriginMapStore>
  <RedisServer>
    <Host>redis:6379</Host>
    <Auth></Auth>
  </RedisServer>
</OriginMapStore>
```

### Redis Configuration

Redis is used for:

- Origin-edge server coordination
- Stream routing information
- Server status tracking

## Port Mapping

| Service  | Component | Port | Description        |
| -------- | --------- | ---- | ------------------ |
| Origin   | RTMP      | 1935 | Stream ingestion   |
| Origin   | HLS       | 8080 | HTTP streaming     |
| Origin   | WebRTC    | 3333 | WebRTC signaling   |
| Origin   | OVT       | 9000 | Edge communication |
| Origin   | API       | 8081 | Management API     |
| Edge 1   | HLS       | 8090 | HTTP streaming     |
| Edge 1   | WebRTC    | 3343 | WebRTC signaling   |
| Edge 1   | API       | 8082 | Management API     |
| Edge 2   | HLS       | 8091 | HTTP streaming     |
| Edge 2   | WebRTC    | 3353 | WebRTC signaling   |
| Edge 2   | API       | 8083 | Management API     |
| Redis    | Redis     | 6379 | Data store         |
| Backend  | API       | 3001 | Backend API        |
| Frontend | Web       | 3000 | Web interface      |

## Stream Flow

### 1. Ingestion Flow

```
OBS/FFmpeg → Origin Server (RTMP:1935) → Authentication → Transcoding → Recording
```

### 2. Distribution Flow

```
Origin Server → OVT:9000 → Edge Servers → OVT:9000 → Stream Relay
```

### 3. Playback Flow

```
Viewer → Edge Server Selection → HLS/WebRTC → Stream Delivery
```

## Edge Server Management API

### Register Edge Server

```bash
curl -X POST http://localhost:3001/api/edge/register \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "edge-us-west-1",
    "serverName": "Edge Server US West",
    "host": "edge1.example.com",
    "ports": {
      "hls": 8080,
      "webrtc": 3333,
      "api": 8081
    },
    "capacity": 1000,
    "region": "us-west"
  }'
```

### Send Heartbeat

```bash
curl -X POST http://localhost:3001/api/edge/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "edge-us-west-1",
    "activeStreams": 25,
    "load": 35.5,
    "status": "active"
  }'
```

### Get Available Servers

```bash
curl http://localhost:3001/api/edge/servers
```

### Get Best Server for Stream

```bash
curl http://localhost:3001/api/edge/best-server/my-stream-id
```

### Route Stream to Specific Server

```bash
curl -X POST http://localhost:3001/api/edge/route-stream \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "my-stream-id",
    "serverId": "edge-us-west-1"
  }'
```

### Get Edge Statistics

```bash
curl http://localhost:3001/api/edge/stats
```

## Load Balancing

The system implements intelligent load balancing:

### 1. Server Selection Algorithm

- **Primary**: Lowest server load percentage
- **Secondary**: Fewest active streams
- **Tertiary**: Geographic preference (region)

### 2. Health Monitoring

- Heartbeat every 30 seconds
- Server timeout after 5 minutes
- Automatic failover to healthy servers

### 3. Stream Distribution

- New streams routed to least loaded server
- Existing streams maintain server affinity
- Automatic re-routing on server failure

## Frontend Integration

The frontend automatically:

- Detects available edge servers
- Tests stream availability
- Selects optimal server
- Provides manual server selection
- Shows server status indicators

### Server Selection Options

- **Auto**: Automatically selects best server
- **Origin**: Direct connection to origin server
- **Edge 1**: Force connection to edge server 1
- **Edge 2**: Force connection to edge server 2

## Monitoring and Troubleshooting

### Health Checks

```bash
# Check all services
docker-compose ps

# Check backend health
curl http://localhost:3001/health

# Check origin server API
curl http://localhost:8081/v1/stats/current

# Check edge server APIs
curl http://localhost:8082/v1/stats/current  # Edge 1
curl http://localhost:8083/v1/stats/current  # Edge 2
```

### Log Monitoring

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f origin-server
docker-compose logs -f edge-server-1
docker-compose logs -f edge-server-2
docker-compose logs -f backend
```

### Common Issues

#### 1. Edge Server Not Receiving Streams

- Check OVT port connectivity (9000)
- Verify Redis connectivity
- Check origin server OVT publisher configuration

#### 2. Stream Not Available on Edge

- Verify stream is active on origin
- Check OVT relay configuration
- Monitor edge server logs for errors

#### 3. Load Balancing Not Working

- Verify backend API connectivity
- Check edge server registration
- Monitor heartbeat status

## Scaling Considerations

### Horizontal Scaling

- Add more edge servers by duplicating the edge service in docker-compose
- Update port mappings to avoid conflicts
- Register new servers with the backend API

### Geographic Distribution

- Deploy edge servers in different regions
- Configure region tags in server registration
- Implement geo-based routing in frontend

### Performance Optimization

- Adjust worker counts based on server capacity
- Configure appropriate buffer sizes
- Monitor and tune transcoding settings

## Security Considerations

### Network Security

- Use VPN or private networks for OVT communication
- Implement TLS for production deployments
- Restrict API access with authentication

### Stream Security

- All authentication handled at origin server
- Edge servers relay authenticated streams
- Token validation prevents unauthorized access

## Production Deployment

### Environment Variables

```bash
# Origin server
OME_HOST_IP=your-origin-ip
REDIS_HOST=your-redis-host

# Edge servers
OME_HOST_IP=your-edge-ip
REDIS_HOST=your-redis-host
ORIGIN_HOST=your-origin-ip

# Backend
NODE_ENV=production
REDIS_URL=redis://your-redis-host:6379
```

### SSL/TLS Configuration

- Configure SSL certificates in OvenMediaEngine
- Update frontend URLs to use HTTPS
- Secure WebRTC with proper certificates

### Database Migration

- Replace in-memory storage with Redis/PostgreSQL
- Implement persistent stream routing
- Add proper session management

## API Reference

### Edge Management Endpoints

| Method | Endpoint                             | Description                |
| ------ | ------------------------------------ | -------------------------- |
| POST   | `/api/edge/register`                 | Register edge server       |
| POST   | `/api/edge/heartbeat`                | Send server heartbeat      |
| GET    | `/api/edge/servers`                  | Get available servers      |
| GET    | `/api/edge/best-server/:streamId`    | Get best server for stream |
| POST   | `/api/edge/route-stream`             | Route stream to server     |
| DELETE | `/api/edge/route-stream/:streamId`   | Remove stream routing      |
| GET    | `/api/edge/stream-routing/:streamId` | Get stream routing info    |
| GET    | `/api/edge/stats`                    | Get edge statistics        |

### Response Format

```json
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

## Support and Troubleshooting

For issues and support:

1. Check the logs for error messages
2. Verify network connectivity between services
3. Ensure all required ports are open
4. Check Redis connectivity and data
5. Monitor server resources (CPU, memory, bandwidth)

## Advanced Configuration

### Custom Load Balancing

Modify the load balancing algorithm in `edgeController.js`:

```javascript
// Custom load balancing logic
const bestServer = servers.reduce((best, current) => {
  // Your custom logic here
  return current.customMetric < best.customMetric ? current : best;
});
```

### Regional Routing

Configure region-based routing:

```javascript
// Filter servers by region
if (region) {
  servers = servers.filter((server) => server.region === region);
}
```

### Health Check Customization

Adjust health check intervals and timeouts:

```javascript
// Cleanup interval (default: 5 minutes)
setInterval(cleanupExpiredServers, 5 * 60 * 1000);

// Server timeout (default: 10 minutes)
const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
```
