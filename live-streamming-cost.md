# Live Streaming Platform Cost Comparison

## Overview

This document compares the costs and benefits of two approaches for implementing a live streaming platform:

1. Using a managed Live Stream API service (Google Cloud Live Stream API)
2. Deploying our own RTMP server on Kubernetes with our existing transcoding service

## Usage Assumptions

- 1000 daily users streaming for 1-2 hours each
- ~100 concurrent broadcasters during peak hours
- Each broadcaster creates one input stream
- 16 active hours per day
- 30 days per month
- Adaptive bitrate streaming with 4 quality levels per stream

## Option 1: Managed Live Stream API

### Detailed Pricing (Google Cloud Live Stream API)

| Component         | Per-Hour Rate |
| ----------------- | ------------- |
| HD (1080p) Input  | $0.14         |
| HD (1080p) Output | $0.45         |
| HD (720p) Output  | $0.45         |
| SD (480p) Output  | $0.22         |
| SD (360p) Output  | $0.22         |

### Estimated Monthly Costs

| Component     | Calculation                              | Hourly Cost      | Monthly Cost      |
| ------------- | ---------------------------------------- | ---------------- | ----------------- |
| Input Streams | 100 concurrent broadcasters × $0.14/hour | $14.00           | $6,720            |
| 1080p Outputs | 100 streams × $0.45/hour                 | $45.00           | $21,600           |
| 720p Outputs  | 100 streams × $0.45/hour                 | $45.00           | $21,600           |
| 480p Outputs  | 100 streams × $0.22/hour                 | $22.00           | $10,560           |
| 360p Outputs  | 100 streams × $0.22/hour                 | $22.00           | $10,560           |
| **Total**     |                                          | **$148.00/hour** | **$71,040/month** |

_Monthly calculation: Hourly cost × 16 hours × 30 days_

### Advantages

- No operational overhead
- Built-in redundancy and failover
- Global distribution
- DDoS protection
- Auto-scaling
- Enterprise-grade reliability
- Simplified monitoring

### Disadvantages

- Extremely high cost
- Less control over configuration
- Potential vendor lock-in
- May have limitations on customization

## Option 2: Own RTMP Server on Kubernetes + Existing Transcoding

### Estimated Monthly Costs

| Component            | Details                                              | Monthly Cost |
| -------------------- | ---------------------------------------------------- | ------------ |
| Primary Node Pool    | 3 × e2-standard-8 nodes with sustained use discount  | $307         |
| Spot Node Pool       | 1-2 × e2-standard-8 nodes (Spot pricing)             | $55-110      |
| GKE Management       | Standard cluster management fee + regional surcharge | $146         |
| Network              | Load balancer + estimated traffic                    | $80          |
| Storage and Registry | Boot disks + container registry                      | $30          |
| Existing Transcoding | Already accounted for in current infrastructure      | $0           |
| **Total**            |                                                      | **$618-673** |

### Advantages

- ~99% cost savings compared to managed API
- Full control over configuration
- Leverages existing transcoding infrastructure
- No additional transcoding costs
- Customizable for specific needs
- No vendor lock-in

### Disadvantages

- Operational overhead of managing Kubernetes
- Need to handle scaling manually or set up autoscaling
- More complex monitoring and troubleshooting
- Requires DevOps expertise

## Cost Comparison

| Solution                               | Monthly Cost | Annual Cost  |
| -------------------------------------- | ------------ | ------------ |
| Managed Live Stream API                | $71,040      | $852,480     |
| Own RTMP Server + Existing Transcoding | $673 (max)   | $8,076       |
| **Savings**                            | **$70,367**  | **$844,404** |

## Resource Requirements

### Kubernetes Configuration

- **Total pods**: 6-7 pods
- **Resources per pod**: 2 CPU, 2GB RAM
- **Primary Node Pool**: 3 × e2-standard-8 nodes
- **Spot Node Pool**: 1-2 × e2-standard-8 nodes
- **Total available resources**: 32-40 vCPU, 128-160GB RAM

## Scaling Considerations

### Managed API

- Automatic scaling based on demand
- No configuration required

### Own RTMP Server

- Horizontal Pod Autoscaler (HPA) configured to scale based on CPU/memory usage
- Node autoscaling from 3 to 6 nodes in primary pool
- Spot instances for handling temporary spikes

## Recommendation

**Recommendation: Deploy our own RTMP server on Kubernetes with our existing transcoding service**

### Justification

1. **Cost efficiency**: ~$673/month vs ~$71,040/month (99% savings)
2. **Existing infrastructure**: Leverages our existing transcoding service
3. **Control**: Provides full control over the streaming pipeline
4. **Scalability**: Kubernetes provides sufficient scalability for our needs
5. **Resource optimization**: Only requires resources for RTMP ingestion, not transcoding

### Implementation Plan

1. Deploy RTMP server containers on our Kubernetes cluster
2. Configure relay to our existing transcoding service
3. Set up autoscaling based on connection count and CPU usage
4. Implement monitoring and alerting
5. Test with gradual traffic increase

### Future Considerations

- Evaluate performance at 50% of projected load
- Adjust resource allocations based on actual usage patterns
- Consider geographic distribution if user base becomes more global
- Implement connection draining for seamless updates

## Conclusion

Using our own RTMP server on Kubernetes with our existing transcoding service provides the most cost-effective solution with potential annual savings of over $844,000 compared to a managed service approach. This approach maintains control and leverages our current infrastructure investments while providing the necessary scalability for our live streaming needs.
