FROM jrottenberg/ffmpeg:5.1-ubuntu

# Install necessary tools
RUN apt-get update && apt-get install -y \
    curl \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Default command
ENTRYPOINT ["/bin/bash"]
CMD ["/app/start.sh"] 