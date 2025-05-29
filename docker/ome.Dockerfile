FROM airensoft/ovenmediaengine:0.14.9

# Create directories for certs and records
RUN mkdir -p /opt/ovenmediaengine/cert /opt/ovenmediaengine/records

# Copy configuration files
COPY ome-config/Server.xml /opt/ovenmediaengine/config/Server.xml

# Generate self-signed certificate for development
RUN apt-get update && \
    apt-get install -y openssl && \
    openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \
        -keyout /opt/ovenmediaengine/cert/cert.key \
        -out /opt/ovenmediaengine/cert/cert.crt && \
    chmod 644 /opt/ovenmediaengine/cert/cert.key

# Expose ports
# RTMP
EXPOSE 1935
# WebRTC
EXPOSE 3333 10000-10004/udp
# TURN/STUN
EXPOSE 3478
# LL-HLS
EXPOSE 8080
# API
EXPOSE 8081 8082

# Set proper permissions
RUN chmod -R 777 /opt/ovenmediaengine/records

# Run OvenMediaEngine
CMD ["/opt/ovenmediaengine/bin/OvenMediaEngine", "-c", "/opt/ovenmediaengine/config"] 