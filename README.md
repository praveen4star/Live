# LiveTube - RTMP Live Streaming Platform

A YouTube-like live streaming platform using RTMP protocol, built with Node.js, Express, and Node-Media-Server.

## Features

- Live streaming using RTMP protocol
- Stream creation with custom titles and descriptions
- Live viewer count
- Stream chat functionality
- Responsive design
- HLS streaming for cross-platform compatibility

## Prerequisites

- [Node.js](https://nodejs.org/) (v12 or higher)
- [FFmpeg](https://ffmpeg.org/) (required for transcoding)

## Installation

1. Clone the repository

```
git clone https://github.com/yourusername/livetube.git
cd livetube
```

2. Install dependencies

```
npm install
```

3. Install FFmpeg (if not already installed)
   - **macOS**: `brew install ffmpeg`
   - **Ubuntu/Debian**: `apt-get install ffmpeg`
   - **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html)

## Usage

1. Start the server

```
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

3. To start streaming:

   - Click "Go Live" in the navigation
   - Fill in your username and stream details
   - Copy the generated stream key and RTMP URL
   - Open your streaming software (OBS, Streamlabs, etc.)
   - Set up a custom stream with the RTMP URL and stream key
   - Start streaming in your software

4. To watch streams:
   - Navigate to the home page
   - Click on any live stream to watch

## Streaming Software Setup (OBS Studio)

1. Open OBS Studio
2. Go to Settings > Stream
3. Select "Custom" for Service
4. Enter the RTMP URL (`rtmp://localhost:1935/live`) in the Server field
5. Enter your stream key in the Stream Key field
6. Click "Apply" and "OK"
7. Click "Start Streaming" in the main OBS window

## Technologies Used

- Node.js
- Express
- Node-Media-Server (RTMP server)
- Video.js (HLS player)
- HTML/CSS/JavaScript

## License

MIT
