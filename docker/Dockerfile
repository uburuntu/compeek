FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:1
ENV DISPLAY_NUM=1
ENV WIDTH=1280
ENV HEIGHT=768

# ── System packages ──────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    # X11 / VNC
    xvfb x11vnc websockify dbus-x11 \
    # XFCE4 desktop
    xfwm4 xfce4-panel xfce4-settings xfce4-terminal thunar \
    # Desktop apps
    mousepad \
    # Desktop utilities
    xdotool scrot xclip imagemagick feh sudo \
    # Modern themes
    arc-theme papirus-icon-theme \
    # Python
    python3 python3-pip \
    # Networking & tools
    netcat-openbsd curl wget git ca-certificates software-properties-common \
    zip unzip jq \
    # Fonts
    fonts-liberation fonts-noto fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# ── Firefox (PPA, not snap) ──────────────────────────────────────
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

# ── Node.js + tools ──────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g localtunnel

RUN pip3 install --break-system-packages vncdotool

RUN curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$(dpkg --print-architecture) -o /usr/local/bin/cloudflared \
    && chmod +x /usr/local/bin/cloudflared

# ── noVNC ────────────────────────────────────────────────────────
RUN git clone --depth 1 --branch v1.6.0 https://github.com/novnc/noVNC.git /opt/novnc
COPY docker/compeek-vnc.html /opt/novnc/compeek-vnc.html

# ── App user + desktop config ────────────────────────────────────
RUN useradd -m -s /bin/bash compeek \
    && mkdir -p /home/compeek/data && chown compeek:compeek /home/compeek/data \
    && echo 'compeek ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/compeek

# Dark gradient wallpaper
RUN convert -size 1280x768 gradient:'#0a0a14'-'#141428' -blur 0x2 /home/compeek/wallpaper.png

# GTK3 dark theme
COPY docker/xfce4/gtk-settings.ini /home/compeek/.config/gtk-3.0/settings.ini

# XFCE4 config: xfwm4 (Arc-Dark decorations), xsettings (theme/icons), panel layout
RUN mkdir -p /home/compeek/.config/xfce4/xfconf/xfce-perchannel-xml
COPY docker/xfce4/xfwm4.xml         /home/compeek/.config/xfce4/xfconf/xfce-perchannel-xml/xfwm4.xml
COPY docker/xfce4/xsettings.xml     /home/compeek/.config/xfce4/xfconf/xfce-perchannel-xml/xsettings.xml
COPY docker/xfce4/xfce4-panel.xml   /home/compeek/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-panel.xml

# If Arc-Dark doesn't ship xfwm4 decorations, fall back to Default
RUN if [ ! -d /usr/share/themes/Arc-Dark/xfwm4 ]; then \
      sed -i 's/Arc-Dark/Default/' /home/compeek/.config/xfce4/xfconf/xfce-perchannel-xml/xfwm4.xml; \
    fi

COPY docker/homepage.html /home/compeek/homepage.html

# ── Build container server ───────────────────────────────────────
WORKDIR /home/compeek/app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/container/ ./src/container/
COPY src/agent/tools.ts src/agent/types.ts src/agent/prompts.ts src/agent/text-editor.ts src/agent/vnc-tools.ts ./src/agent/
COPY src/lib/ ./src/lib/
COPY src/mcp/ ./src/mcp/

RUN npx tsc --outDir dist
RUN npm prune --omit=dev

# ── Example apps + entrypoint ────────────────────────────────────
COPY examples/ /home/compeek/examples/
COPY docker/entrypoint.sh /home/compeek/entrypoint.sh
RUN chmod +x /home/compeek/entrypoint.sh

# ── Finalize ─────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

RUN chown -R compeek:compeek /home/compeek

EXPOSE 3000 5900 6080 8080
USER compeek
CMD ["/home/compeek/entrypoint.sh"]
