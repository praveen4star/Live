import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Card, Row, Col, Button } from "react-bootstrap";

const Home = () => {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);

  // In a real application, this would fetch from a backend
  // For now, we'll use the SRS API to check if there are any live streams
  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const response = await axios.get(
          "http://localhost:1985/api/v1/streams/"
        );

        // SRS returns streams in a different format than what we need
        // We'll transform it to our desired format
        if (response.data && response.data.streams) {
          console.log(
            `Found ${response.data.streams.length} stream variants in total`
          );

          // Group streams by their base stream key (before any underscore)
          const streamGroups = {};

          // First pass: group streams by base key
          response.data.streams.forEach((stream) => {
            // Extract the base stream key (everything before the first underscore)
            const baseStreamKey = stream.name.split("_")[0];

            // Add stream to appropriate group
            if (!streamGroups[baseStreamKey]) {
              streamGroups[baseStreamKey] = {
                id: baseStreamKey,
                title: `Live Stream: ${baseStreamKey}`,
                streamer: "Anonymous",
                viewers: 0,
                thumbnailUrl:
                  "https://placehold.co/320x180/000000/FFFFFF/?text=Live+Stream",
                isLive: stream.publish?.active || false,
                clientCount: 0,
                variants: [],
              };
            }

            // Update the stream group with this variant's info
            streamGroups[baseStreamKey].variants.push(stream.name);
            streamGroups[baseStreamKey].clientCount += stream.clients || 0;

            // If any variant is active, mark the stream as live
            if (stream.publish?.active) {
              streamGroups[baseStreamKey].isLive = true;
            }
          });

          console.log(
            `Grouped into ${Object.keys(streamGroups).length} unique streams`
          );

          // Convert the groups object to an array for rendering
          const uniqueStreams = Object.values(streamGroups).map((stream) => ({
            ...stream,
            // Set viewers count based on client count
            viewers: stream.clientCount || 0,
          }));

          console.log(
            `Displaying ${uniqueStreams.length} unique streams on the home page`
          );
          setStreams(uniqueStreams);
        } else {
          console.log("No streams found");
          setStreams([]);
        }
      } catch (error) {
        console.error("Error fetching streams:", error);
        setStreams([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStreams();
    // Poll for streams every 10 seconds
    const interval = setInterval(fetchStreams, 10000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="text-center my-5">Loading streams...</div>;
  }

  return (
    <div>
      <div className="jumbotron bg-light p-4 mb-4 rounded">
        <h1>Welcome to Live Streaming Platform</h1>
        <p className="lead">
          Stream with ultra-low latency and watch your favorite content
          creators.
        </p>
        <p>
          <Link to="/stream">
            <Button variant="primary">Start Streaming</Button>
          </Link>
        </p>
      </div>

      <h2 className="mb-4">Live Now</h2>

      {streams.length === 0 ? (
        <div className="alert alert-info">
          No live streams available right now. Be the first to go live!
        </div>
      ) : (
        <Row>
          {streams.map((stream) => (
            <Col key={stream.id} md={4} className="mb-4">
              <Card>
                <Card.Img variant="top" src={stream.thumbnailUrl} />
                <Card.Body>
                  <div className="stream-status live mb-2">LIVE</div>
                  <Card.Title>{stream.title}</Card.Title>
                  <Card.Text>
                    {stream.streamer} • {stream.viewers} viewers
                  </Card.Text>
                  <Link to={`/watch/${stream.id}`}>
                    <Button variant="primary">Watch Stream</Button>
                  </Link>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default Home;
