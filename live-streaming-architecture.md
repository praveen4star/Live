# Live Streaming Architecture Comparison

## Architecture Options with Camera Support

Below are the architectural diagrams for both Google Cloud Live Stream API and our own RTMP server solution, including camera streaming support.

### Option 1: Google Cloud Live Stream API Architecture

```mermaid
flowchart TD
    subgraph "Sources"
        Mobile["Mobile App\n(Camera)"]
        OBS["OBS/Streaming Software"]
        Browser["Browser\n(WebRTC Camera)"]
    end

    subgraph "Gateway Layer"
        WebRTCGW["WebRTC to RTMP Gateway\n(Required for Browser)"]
    end

    subgraph "Google Cloud Live Stream API"
        GCInput["Input Endpoints\n($0.14/hr per stream)"]
        GCTrans["Google Transcoding\n($0.45/hr per HD output)"]
        GCOutput["Output Generation\n(HLS/DASH)"]
    end

    subgraph "Delivery"
        CDN["Content Delivery Network"]
        Viewers["Viewers"]
    end

    %% Connections
    Mobile -->|RTMP| GCInput
    OBS -->|RTMP| GCInput
    Browser -->|WebRTC| WebRTCGW
    WebRTCGW -->|RTMP| GCInput
    GCInput --> GCTrans
    GCTrans --> GCOutput
    GCOutput -->|HLS/DASH| CDN
    CDN --> Viewers

    %% Styling
    classDef sources fill:#d4f1f9,stroke:#05a3d6
    classDef gateway fill:#ffe6cc,stroke:#d79b00
    classDef googlecloud fill:#dae8fc,stroke:#6c8ebf
    classDef delivery fill:#d5e8d4,stroke:#82b366

    class Mobile,OBS,Browser sources
    class WebRTCGW gateway
    class GCInput,GCTrans,GCOutput googlecloud
    class CDN,Viewers delivery

    %% Notes
    GCTrans -.->|"Note: Cannot use your own\ntranscoding service"| GCOutput
```

### Option 2: Own RTMP Server with Existing Transcoding

```mermaid
flowchart TD
    subgraph "Sources"
        Mobile["Mobile App\n(Camera)"]
        OBS["OBS/Streaming Software"]
        Browser["Browser\n(WebRTC Camera)"]
    end

    subgraph "Gateway Layer"
        WebRTCGW["WebRTC to RTMP Gateway\n(Required for Browser)"]
    end

    subgraph "Our Infrastructure (Kubernetes)"
        RTMPServer["RTMP Server\n(node-media-server)"]
        TransService["Existing Transcoding Service"]
        HLSOutput["HLS/DASH Packager"]
    end

    subgraph "Delivery"
        CDN["Content Delivery Network"]
        Viewers["Viewers"]
    end

    %% Connections
    Mobile -->|RTMP| RTMPServer
    OBS -->|RTMP| RTMPServer
    Browser -->|WebRTC| WebRTCGW
    WebRTCGW -->|RTMP| RTMPServer
    RTMPServer --> TransService
    TransService --> HLSOutput
    HLSOutput -->|HLS/DASH| CDN
    CDN --> Viewers

    %% Styling
    classDef sources fill:#d4f1f9,stroke:#05a3d6
    classDef gateway fill:#ffe6cc,stroke:#d79b00
    classDef infrastructure fill:#e1d5e7,stroke:#9673a6
    classDef delivery fill:#d5e8d4,stroke:#82b366

    class Mobile,OBS,Browser sources
    class WebRTCGW gateway
    class RTMPServer,TransService,HLSOutput infrastructure
    class CDN,Viewers delivery
```

## Cost Comparison

### Google Cloud Live Stream API

- WebRTC Gateway: $250/month
- Google Cloud Streaming: $71,040/month
- **Total: $71,290/month**

### Own RTMP Server + Existing Transcoding

- WebRTC Gateway: $250/month
- RTMP Server + Kubernetes: $673/month
- **Total: $923/month**
- **Savings: $70,367/month (98.7%)**

## Component Details

### WebRTC to RTMP Gateway

- Required in both scenarios for browser-based camera streaming
- Converts WebRTC protocol used by browsers to RTMP protocol
- Deployed as part of Kubernetes infrastructure
- Estimated cost: $250/month

### RTMP Server (Own Solution)

- Receives RTMP streams from various sources
- Forwards to transcoding service
- Lightweight and efficient
- Part of $673/month infrastructure cost

### Transcoding Service

- In Google Cloud: Built-in, mandatory ($0.45/hr per HD output)
- In Own Solution: Using existing service (no additional cost)
- Creates multiple quality variants for adaptive streaming

## Conclusion

Both architectures support camera streaming from browsers and mobile devices. The key difference is that Google Cloud Live Stream API bundles transcoding as a mandatory service that cannot be replaced with your own, while our own RTMP solution leverages existing transcoding infrastructure.

The WebRTC to RTMP gateway is required in both scenarios for browser-based streaming. This component adds the same cost to both solutions, maintaining the significant cost advantage of our own infrastructure approach.
