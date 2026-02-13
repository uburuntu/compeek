FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:1
ENV DISPLAY_NUM=1
ENV WIDTH=1024
ENV HEIGHT=768

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # X11 / VNC
    xvfb \
    x11vnc \
    mutter \
    tint2 \
    # noVNC
    novnc \
    websockify \
    # Desktop utilities
    xdotool \
    scrot \
    xclip \
    imagemagick \
    # Python (for simple file server)
    python3 \
    # Build tools
    curl \
    git \
    ca-certificates \
    software-properties-common \
    # Fonts
    fonts-liberation \
    fonts-noto \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Install Firefox from PPA (not snap)
RUN add-apt-repository ppa:mozillateam/ppa -y \
    && echo 'Package: *\nPin: release o=LP-PPA-mozillateam\nPin-Priority: 1001' > /etc/apt/preferences.d/mozilla-firefox \
    && apt-get update && apt-get install -y firefox \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install localtunnel globally for public access
RUN npm install -g localtunnel

# Create app user
RUN useradd -m -s /bin/bash compeek
WORKDIR /home/compeek/app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source and build the container server
COPY tsconfig.json ./
COPY src/container/ ./src/container/
COPY src/agent/tools.ts src/agent/types.ts src/agent/prompts.ts ./src/agent/
COPY src/lib/ ./src/lib/

RUN npx tsc --outDir dist

# Copy entrypoint script
COPY docker/entrypoint.sh /home/compeek/entrypoint.sh
RUN chmod +x /home/compeek/entrypoint.sh

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Set ownership
RUN chown -R compeek:compeek /home/compeek

# Expose ports: 3000 (tool API), 5900 (VNC), 6080 (noVNC), 8080 (target app)
EXPOSE 3000 5900 6080 8080

# Run as compeek user
USER compeek

CMD ["/home/compeek/entrypoint.sh"]
