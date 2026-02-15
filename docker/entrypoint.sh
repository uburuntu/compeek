#!/bin/bash
set -e

DESKTOP_MODE="${DESKTOP_MODE:-full}"
DASHBOARD_URL="${DASHBOARD_URL:-https://compeek.rmbk.me}"
export GTK_THEME=Adwaita:dark

# Auto-generate session password if not provided (used for both VNC and API auth)
if [ -z "$VNC_PASSWORD" ]; then
  VNC_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 24)
fi
export API_TOKEN="$VNC_PASSWORD"

echo ""
echo "========================================="
echo "  compeek desktop container"
echo "  mode: ${DESKTOP_MODE}"
echo "========================================="
echo ""

# Step counter
STEP=1

# ── Sidecar mode: bridge to a dockur Windows/macOS VM via VNC ──
if [ "$DESKTOP_MODE" = "sidecar" ]; then
  SIDECAR_TARGET="${SIDECAR_TARGET:-localhost}"
  SIDECAR_VNC_PORT="${SIDECAR_VNC_PORT:-5900}"
  SIDECAR_VIEWER_PORT="${SIDECAR_VIEWER_PORT:-8006}"
  SIDECAR_OS="${SIDECAR_OS:-unknown}"

  echo "[${STEP}] Sidecar mode — waiting for VM VNC at ${SIDECAR_TARGET}:${SIDECAR_VNC_PORT}..."
  STEP=$((STEP + 1))
  for i in $(seq 1 120); do
    if nc -z "$SIDECAR_TARGET" "$SIDECAR_VNC_PORT" 2>/dev/null; then
      echo "  VM VNC is available"
      break
    fi
    if [ "$i" = "120" ]; then
      echo "  Warning: VM VNC not reachable after 120s, starting anyway"
    fi
    sleep 1
  done

  echo "[${STEP}] Setting up noVNC proxy to VM viewer at ${SIDECAR_TARGET}:${SIDECAR_VIEWER_PORT}..."
  websockify --web /opt/novnc 6080 ${SIDECAR_TARGET}:${SIDECAR_VIEWER_PORT} &
  sleep 0.5
  STEP=$((STEP + 1))

  echo "[${STEP}] Starting sidecar tool server on port ${PORT:-3000}..."
  cd /home/compeek/app
  node dist/container/server.js &
  TOOL_PID=$!
  sleep 1
  STEP=$((STEP + 1))

  # Build connection string
  SESSION_NAME="${COMPEEK_SESSION_NAME:-${SIDECAR_OS} Desktop}"
  API_PORT="${PORT:-3000}"
  VNC_PORT="6080"

  CONFIG_JSON="{\"name\":\"${SESSION_NAME}\",\"type\":\"compeek\",\"apiHost\":\"localhost\",\"apiPort\":${API_PORT},\"vncHost\":\"localhost\",\"vncPort\":${VNC_PORT},\"vncPassword\":\"${VNC_PASSWORD}\",\"osType\":\"${SIDECAR_OS}\"}"
  CONFIG_B64=$(echo -n "$CONFIG_JSON" | base64 -w 0 2>/dev/null || echo -n "$CONFIG_JSON" | base64)

  echo ""
  echo "========================================="
  echo "  compeek sidecar (${SIDECAR_OS} VM)"
  echo "========================================="
  echo "  Tool API : http://localhost:${API_PORT}"
  echo "  noVNC    : http://localhost:${VNC_PORT}"
  echo ""
  echo "  Connection string:"
  echo "  ${CONFIG_B64}"
  echo ""
  echo "  Dashboard link:"
  echo "  ${DASHBOARD_URL}/#config=${CONFIG_B64}"
  echo "========================================="
  echo ""

  wait $TOOL_PID
  exit 0
fi

# ── Standard desktop modes (full, browser, minimal, headless) ──

# 1. Start Xvfb (always needed — tool server uses DISPLAY for screenshots)
echo "[${STEP}] Starting Xvfb..."
Xvfb :1 -screen 0 ${WIDTH:-1280}x${HEIGHT:-720}x24 -ac &
sleep 1
STEP=$((STEP + 1))

# 2. Start window manager (skip in headless)
if [ "$DESKTOP_MODE" != "headless" ]; then
  echo "[${STEP}] Starting XFWM4..."
  DISPLAY=:1 GTK_THEME=Adwaita:dark xfwm4 --daemon &
  sleep 1
  STEP=$((STEP + 1))

  # Set wallpaper
  if [ -f /home/compeek/wallpaper.png ]; then
    DISPLAY=:1 feh --bg-fill /home/compeek/wallpaper.png &
  fi
fi

# 3. Start panel (full mode only)
if [ "$DESKTOP_MODE" = "full" ]; then
  echo "[${STEP}] Starting Tint2..."
  DISPLAY=:1 tint2 &
  sleep 0.5
  STEP=$((STEP + 1))
fi

# 4. Start VNC + noVNC (skip in headless)
if [ "$DESKTOP_MODE" != "headless" ]; then
  echo "[${STEP}] Starting x11vnc..."
  VNC_ARGS="-display :1 -listen 0.0.0.0 -rfbport 5900 -forever -shared -bg"
  # Set up password file
  mkdir -p /home/compeek/.vnc
  x11vnc -storepasswd "$VNC_PASSWORD" /home/compeek/.vnc/passwd
  VNC_ARGS="$VNC_ARGS -rfbauth /home/compeek/.vnc/passwd"
  echo "  VNC password: $VNC_PASSWORD"
  x11vnc $VNC_ARGS
  STEP=$((STEP + 1))

  echo "[${STEP}] Starting noVNC on port 6080..."
  websockify --web /opt/novnc 6080 localhost:5900 &
  sleep 0.5
  STEP=$((STEP + 1))
fi

# 5. Firefox profile persistence (when data volume is mounted)
FIREFOX_PROFILE_ARGS=""
if mountpoint -q /home/compeek/data 2>/dev/null; then
  FIREFOX_PROFILE_DIR="/home/compeek/data/firefox-profile"
  mkdir -p "$FIREFOX_PROFILE_DIR"
  FIREFOX_PROFILE_ARGS="--profile $FIREFOX_PROFILE_DIR"
  echo "[${STEP}] Using persistent Firefox profile: $FIREFOX_PROFILE_DIR"
  STEP=$((STEP + 1))
fi

# 6. Start target app + Firefox
if [ "$DESKTOP_MODE" = "full" ] || [ "$DESKTOP_MODE" = "browser" ]; then
  # Start target app if available (full mode only)
  if [ "$DESKTOP_MODE" = "full" ] && [ -d /home/compeek/target-app ]; then
    echo "[${STEP}] Starting target app on port 8080..."
    cd /home/compeek/target-app
    python3 -m http.server 8080 &
    sleep 0.5
    STEP=$((STEP + 1))

    echo "[${STEP}] Opening Firefox to target app..."
    DISPLAY=:1 firefox $FIREFOX_PROFILE_ARGS http://localhost:8080 &
  else
    echo "[${STEP}] Opening Firefox..."
    DISPLAY=:1 firefox $FIREFOX_PROFILE_ARGS &
  fi
  sleep 3

  # Maximize Firefox window
  DISPLAY=:1 xdotool search --onlyvisible --class Firefox windowactivate --sync key F11 2>/dev/null || true
  STEP=$((STEP + 1))
fi

# 7. Start tool server
echo "[${STEP}] Starting tool server on port ${PORT:-3000}..."
cd /home/compeek/app
node dist/container/server.js &
TOOL_PID=$!
sleep 1

# Build connection string
SESSION_NAME="${COMPEEK_SESSION_NAME:-Desktop}"
API_PORT="${PORT:-3000}"
VNC_PORT="6080"

CONFIG_JSON="{\"name\":\"${SESSION_NAME}\",\"type\":\"compeek\",\"apiHost\":\"localhost\",\"apiPort\":${API_PORT},\"vncHost\":\"localhost\",\"vncPort\":${VNC_PORT},\"vncPassword\":\"${VNC_PASSWORD}\"}"
CONFIG_B64=$(echo -n "$CONFIG_JSON" | base64 -w 0 2>/dev/null || echo -n "$CONFIG_JSON" | base64)

echo ""
echo "========================================="
echo "  Local access"
echo "========================================="
echo "  Tool API : http://localhost:${API_PORT}"
if [ "$DESKTOP_MODE" != "headless" ]; then
  echo "  noVNC    : http://localhost:${VNC_PORT}"
  echo "  VNC      : vnc://localhost:5900"
fi
echo ""
echo "  Connection string:"
echo "  ${CONFIG_B64}"
echo ""
echo "  Dashboard link:"
echo "  ${DASHBOARD_URL}/#config=${CONFIG_B64}"
echo "========================================="
echo ""

# Start tunnels (cloudflare or localtunnel)
TUNNEL_PROVIDER="${TUNNEL_PROVIDER:-none}"

if [ "$TUNNEL_PROVIDER" != "none" ] && [ "$DESKTOP_MODE" != "headless" ]; then
  echo "[${STEP}] Starting ${TUNNEL_PROVIDER} tunnels..."
  STEP=$((STEP + 1))

  if [ "$TUNNEL_PROVIDER" = "cloudflare" ] && command -v cloudflared &> /dev/null; then
    # Cloudflare Quick Tunnel — no account needed, uses *.trycloudflare.com
    cloudflared tunnel --url http://localhost:${API_PORT} --no-autoupdate 2>&1 | while IFS= read -r line; do
      url=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' || true)
      if [ -n "$url" ] && [ ! -f /tmp/tunnel-api.url ]; then
        echo "$url" > /tmp/tunnel-api.url
        echo "  API tunnel: $url"
      fi
    done &

    cloudflared tunnel --url http://localhost:${VNC_PORT} --no-autoupdate 2>&1 | while IFS= read -r line; do
      url=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' || true)
      if [ -n "$url" ] && [ ! -f /tmp/tunnel-vnc.url ]; then
        echo "$url" > /tmp/tunnel-vnc.url
        echo "  VNC tunnel: $url"
      fi
    done &

  elif [ "$TUNNEL_PROVIDER" = "localtunnel" ] && command -v lt &> /dev/null; then
    # Localtunnel — uses *.loca.lt
    lt --port ${API_PORT} 2>&1 | while IFS= read -r line; do
      url=$(echo "$line" | grep -oE 'https://[^ ]+' || true)
      if [ -n "$url" ] && [ ! -f /tmp/tunnel-api.url ]; then
        echo "$url" > /tmp/tunnel-api.url
        echo "  API tunnel: $url"
      fi
    done &

    lt --port ${VNC_PORT} 2>&1 | while IFS= read -r line; do
      url=$(echo "$line" | grep -oE 'https://[^ ]+' || true)
      if [ -n "$url" ] && [ ! -f /tmp/tunnel-vnc.url ]; then
        echo "$url" > /tmp/tunnel-vnc.url
        echo "  VNC tunnel: $url"
      fi
    done &

  else
    echo "  Warning: ${TUNNEL_PROVIDER} binary not found, skipping tunnels."
  fi
elif [ "$DESKTOP_MODE" = "headless" ]; then
  echo "Headless mode — tunnels skipped."
fi

# Wait for tool server
wait $TOOL_PID
