#!/bin/bash
set -e

DESKTOP_MODE="${DESKTOP_MODE:-full}"
DASHBOARD_URL="${DASHBOARD_URL:-https://compeek.rmbk.me}"

echo ""
echo "========================================="
echo "  compeek desktop container"
echo "  mode: ${DESKTOP_MODE}"
echo "========================================="
echo ""

# Step counter
STEP=1

# 1. Start Xvfb (always needed — tool server uses DISPLAY for screenshots)
echo "[${STEP}] Starting Xvfb..."
Xvfb :1 -screen 0 ${WIDTH:-1024}x${HEIGHT:-768}x24 -ac &
sleep 1
STEP=$((STEP + 1))

# 2. Start window manager (skip in headless)
if [ "$DESKTOP_MODE" != "headless" ]; then
  echo "[${STEP}] Starting Mutter..."
  DISPLAY=:1 mutter --replace --sm-disable &
  sleep 1
  STEP=$((STEP + 1))
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
  x11vnc -display :1 -nopw -listen 0.0.0.0 -rfbport 5900 -forever -shared -bg
  STEP=$((STEP + 1))

  echo "[${STEP}] Starting noVNC on port 6080..."
  websockify --web /usr/share/novnc 6080 localhost:5900 &
  sleep 0.5
  STEP=$((STEP + 1))
fi

# 5. Start target app + Firefox (full mode only)
if [ "$DESKTOP_MODE" = "full" ]; then
  if [ -d /home/compeek/target-app ]; then
    echo "[${STEP}] Starting target app on port 8080..."
    cd /home/compeek/target-app
    python3 -m http.server 8080 &
    sleep 0.5

    echo "[${STEP}] Opening Firefox..."
    DISPLAY=:1 firefox http://localhost:8080 &
    sleep 2
    STEP=$((STEP + 1))
  else
    echo "[${STEP}] No target app found, skipping."
    STEP=$((STEP + 1))
  fi
elif [ "$DESKTOP_MODE" = "browser" ]; then
  echo "[${STEP}] Opening Firefox..."
  DISPLAY=:1 firefox &
  sleep 2
  STEP=$((STEP + 1))
fi

# 6. Start tool server
echo "[${STEP}] Starting tool server on port ${PORT:-3000}..."
cd /home/compeek/app
node dist/container/server.js &
TOOL_PID=$!
sleep 1

# Build connection string
SESSION_NAME="${COMPEEK_SESSION_NAME:-Desktop}"
API_PORT="${PORT:-3000}"
VNC_PORT="6080"

CONFIG_JSON="{\"name\":\"${SESSION_NAME}\",\"type\":\"compeek\",\"apiHost\":\"localhost\",\"apiPort\":${API_PORT},\"vncHost\":\"localhost\",\"vncPort\":${VNC_PORT}}"
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

# Start localtunnel if available (skip in headless)
if command -v lt &> /dev/null && [ "$DESKTOP_MODE" != "headless" ]; then
  echo "Starting localtunnel..."

  # Tunnel for tool API
  lt --port ${API_PORT} 2>&1 | while IFS= read -r line; do
    if echo "$line" | grep -q "https://"; then
      TOOL_URL=$(echo "$line" | grep -oP 'https://[^ ]+')
      echo ""
      echo "========================================="
      echo "  Public access (localtunnel)"
      echo "========================================="
      echo "  Tool API : $TOOL_URL"
      echo "========================================="
      echo ""
      echo "  Use this URL as the API host when"
      echo "  adding a session in the compeek UI."
      echo ""
    fi
  done &

  # Tunnel for noVNC
  lt --port ${VNC_PORT} 2>&1 | while IFS= read -r line; do
    if echo "$line" | grep -q "https://"; then
      VNC_URL=$(echo "$line" | grep -oP 'https://[^ ]+')
      echo "  noVNC    : $VNC_URL"
    fi
  done &
elif [ "$DESKTOP_MODE" = "headless" ]; then
  echo "Headless mode — VNC and localtunnel skipped."
else
  echo "localtunnel not installed. For public access: npm i -g localtunnel"
fi

# Wait for tool server
wait $TOOL_PID
