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
    xfwm4 \
    tint2 \
    # noVNC dependencies
    websockify \
    # Desktop utilities
    xdotool \
    scrot \
    xclip \
    imagemagick \
    feh \
    xfce4-terminal \
    thunar \
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
    "Homepage": { "URL": "file:///home/compeek/homepage.html", "Locked": false, "StartPage": "homepage" },
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

# Install noVNC from GitHub (apt package has version mismatches on 24.04)
RUN git clone --depth 1 --branch v1.6.0 https://github.com/novnc/noVNC.git /opt/novnc

# Custom noVNC viewer optimized for iframe embedding
COPY docker/compeek-vnc.html /opt/novnc/compeek-vnc.html

# Create app user
RUN useradd -m -s /bin/bash compeek
RUN mkdir -p /home/compeek/data && chown compeek:compeek /home/compeek/data

# Desktop theming: dark wallpaper + tint2 panel config + GTK dark mode
RUN convert -size 1280x720 \
    gradient:'#0a0a14'-'#141428' \
    -blur 0x2 \
    /home/compeek/wallpaper.png

COPY docker/tint2rc /home/compeek/.config/tint2/tint2rc
RUN mkdir -p /home/compeek/.config/gtk-3.0 \
    && printf '[Settings]\ngtk-application-prefer-dark-theme=1\ngtk-theme-name=Adwaita-dark\ngtk-icon-theme-name=Adwaita\n' \
       > /home/compeek/.config/gtk-3.0/settings.ini

# XFWM4 dark theme
RUN mkdir -p /home/compeek/.config/xfce4/xfconf/xfce-perchannel-xml \
    && printf '<?xml version="1.0" encoding="UTF-8"?>\n<channel name="xfwm4" version="1.0">\n  <property name="general" type="empty">\n    <property name="theme" type="string" value="Default-xhdpi"/>\n    <property name="title_font" type="string" value="Noto Sans Bold 9"/>\n    <property name="button_layout" type="string" value="O|HMC"/>\n  </property>\n</channel>\n' \
       > /home/compeek/.config/xfce4/xfconf/xfce-perchannel-xml/xfwm4.xml

# Branded homepage for Firefox
COPY docker/homepage.html /home/compeek/homepage.html

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
