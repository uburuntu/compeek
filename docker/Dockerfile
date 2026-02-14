FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:1
ENV DISPLAY_NUM=1
ENV WIDTH=1280
ENV HEIGHT=720

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

# Firefox enterprise policies: uBlock Origin, disable telemetry/updates, clean startup
RUN mkdir -p /usr/lib/firefox/distribution && cat > /usr/lib/firefox/distribution/policies.json << 'POLICIES'
{
  "policies": {
    "ExtensionSettings": {
      "uBlock0@raymondhill.net": {
        "installation_mode": "force_installed",
        "install_url": "https://addons.mozilla.org/firefox/downloads/latest/ublock-origin/latest.xpi"
      }
    },
    "DisableAppUpdate": true,
    "DontCheckDefaultBrowser": true,
    "DisableTelemetry": true,
    "DisableFirefoxStudies": true,
    "DisablePocket": true,
    "OverrideFirstRunPage": "",
    "OverridePostUpdatePage": "",
    "Homepage": { "URL": "about:blank", "Locked": false, "StartPage": "homepage" },
    "NewTabPage": false,
    "NoDefaultBookmarks": true,
    "OfferToSaveLogins": false,
    "PasswordManagerEnabled": false,
    "FirefoxSuggest": { "WebSuggestions": false, "SponsoredSuggestions": false, "ImproveSuggest": false },
    "UserMessaging": { "WhatsNew": false, "ExtensionRecommendations": false, "FeatureRecommendations": false, "UrlbarInterventions": false, "SkipOnboarding": true, "MoreFromMozilla": false, "FirefoxLabs": false }
  }
}
POLICIES

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install localtunnel globally for public access
RUN npm install -g localtunnel

# Create app user
RUN useradd -m -s /bin/bash compeek
RUN mkdir -p /home/compeek/data && chown compeek:compeek /home/compeek/data
WORKDIR /home/compeek/app

# Copy package.json and install dependencies (including dev for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build the container server
COPY tsconfig.json ./
COPY src/container/ ./src/container/
COPY src/agent/tools.ts src/agent/types.ts src/agent/prompts.ts ./src/agent/
COPY src/lib/ ./src/lib/

RUN npx tsc --outDir dist

# Remove dev dependencies after build
RUN npm prune --omit=dev

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
