import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button, Card, InputGroup, FormControl } from "react-bootstrap";
import axios from "axios";

const StreamerDashboard = () => {
  const [streamKey, setStreamKey] = useState("");
  const [streamUrl, setStreamUrl] = useState("rtmp://localhost:1935/live");
  const [isLive, setIsLive] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Generate a unique stream key on component mount
  useEffect(() => {
    // Use a persistent key if available in localStorage, or generate a new one
    const savedKey = localStorage.getItem("streamKey");
    if (savedKey) {
      setStreamKey(savedKey);
    } else {
      const newKey = uuidv4().replace(/-/g, "").substring(0, 16);
      setStreamKey(newKey);
      localStorage.setItem("streamKey", newKey);
    }
  }, []);

  // Check if the stream is currently live
  useEffect(() => {
    const checkStreamStatus = async () => {
      try {
        const response = await axios.get(
          "http://localhost:1985/api/v1/streams/"
        );

        // Check if our stream key is in the active streams
        if (response.data && response.data.streams) {
          const matchingStreams = response.data.streams.filter(
            (stream) =>
              stream.name === streamKey ||
              stream.name.startsWith(`${streamKey}_`)
          );

          // Check if any of the matching streams have an active publisher
          const hasActivePublisher = matchingStreams.some(
            (stream) => stream.publish && stream.publish.active === true
          );

          setIsLive(hasActivePublisher || matchingStreams.length > 0);
        } else {
          setIsLive(false);
        }
      } catch (error) {
        console.error("Error checking stream status:", error);
        setIsLive(false);
      }
    };

    checkStreamStatus();
    // Poll for stream status every 5 seconds
    const interval = setInterval(checkStreamStatus, 5000);

    return () => clearInterval(interval);
  }, [streamKey]);

  // Generate a new stream key
  const generateNewKey = () => {
    const newKey = uuidv4().replace(/-/g, "").substring(0, 16);
    setStreamKey(newKey);
    localStorage.setItem("streamKey", newKey);
  };

  // Copy stream key to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert("Copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  return (
    <div>
      <h1 className="mb-4">Stream Dashboard</h1>

      <div className="mb-4">
        <div className={`stream-status ${isLive ? "live" : "offline"}`}>
          {isLive ? "LIVE" : "OFFLINE"}
        </div>
      </div>

      <Card className="mb-4">
        <Card.Header>Your Stream Key</Card.Header>
        <Card.Body>
          <InputGroup className="mb-3">
            <FormControl
              type={showKey ? "text" : "password"}
              value={streamKey}
              readOnly
            />
            <Button
              variant="outline-secondary"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? "Hide" : "Show"}
            </Button>
            <Button
              variant="outline-secondary"
              onClick={() => copyToClipboard(streamKey)}
            >
              Copy
            </Button>
            <Button variant="outline-danger" onClick={generateNewKey}>
              Generate New
            </Button>
          </InputGroup>
          <div className="alert alert-warning">
            <strong>Warning:</strong> Keep your stream key private! Anyone with
            this key can stream to your channel.
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Header>RTMP URL</Card.Header>
        <Card.Body>
          <InputGroup className="mb-3">
            <FormControl type="text" value={streamUrl} readOnly />
            <Button
              variant="outline-secondary"
              onClick={() => copyToClipboard(streamUrl)}
            >
              Copy
            </Button>
          </InputGroup>
        </Card.Body>
      </Card>

      <div className="stream-instructions">
        <h3>Streaming Instructions</h3>
        <h4>OBS Studio Setup:</h4>
        <ol>
          <li>Open OBS Studio</li>
          <li>Go to Settings → Stream</li>
          <li>Select "Custom..." as the service</li>
          <li>
            Set the Server to: <code>{streamUrl}</code>
          </li>
          <li>
            Set the Stream Key to:{" "}
            <code>{showKey ? streamKey : "••••••••••••••••"}</code>
          </li>
          <li>Click "OK" and then "Start Streaming" in the main window</li>
        </ol>

        <h4>Stream URL for Viewers:</h4>
        <p>
          Share this link with your viewers:
          <br />
          <code>
            {window.location.origin}/watch/{streamKey}
          </code>
          <Button
            variant="outline-primary"
            size="sm"
            className="ms-2"
            onClick={() =>
              copyToClipboard(`${window.location.origin}/watch/${streamKey}`)
            }
          >
            Copy
          </Button>
        </p>
      </div>
    </div>
  );
};

export default StreamerDashboard;
