#!/usr/bin/env bash
set -euo pipefail

IMAGE="ghcr.io/uburuntu/compeek:latest"
CONTAINER_NAME="compeek-1"
API_PORT=3001
VNC_PORT=6081
DASHBOARD_URL="https://compeek.rmbk.me"
HEALTH_TIMEOUT=30

# ── Banner ────────────────────────────────────────────────

echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║           compeek installer           ║"
echo "  ║   AI eyes & hands for any desktop     ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""

# ── OS detection ──────────────────────────────────────────

detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS="linux"
    if command -v apt-get &>/dev/null; then
      PKG_MANAGER="apt"
    elif command -v yum &>/dev/null; then
      PKG_MANAGER="yum"
    elif command -v dnf &>/dev/null; then
      PKG_MANAGER="dnf"
    else
      PKG_MANAGER="unknown"
    fi
  elif [ "$(uname)" = "Darwin" ]; then
    OS="macos"
    PKG_MANAGER="brew"
  elif grep -qi microsoft /proc/version 2>/dev/null; then
    OS="wsl2"
    PKG_MANAGER="apt"
  else
    OS="unknown"
    PKG_MANAGER="unknown"
  fi
  echo "  Detected: ${OS} (${PKG_MANAGER})"
}

detect_os

# ── Docker check/install ─────────────────────────────────

install_docker() {
  echo ""
  echo "  Docker is not installed."

  case "$OS" in
    linux)
      echo "  Installing Docker via get.docker.com..."
      echo "  This requires sudo access."
      curl -fsSL https://get.docker.com | sudo sh
      sudo usermod -aG docker "$USER" 2>/dev/null || true
      echo "  Docker installed. You may need to log out and back in for group changes."
      ;;
    macos)
      if command -v brew &>/dev/null; then
        echo "  Installing Docker Desktop via Homebrew..."
        brew install --cask docker
        echo "  Docker Desktop installed. Please open Docker Desktop to start the daemon."
        echo "  Then re-run this script."
        exit 0
      else
        echo "  Install Docker Desktop from: https://www.docker.com/products/docker-desktop/"
        exit 1
      fi
      ;;
    wsl2)
      echo "  Install Docker Desktop for Windows with WSL2 backend:"
      echo "  https://docs.docker.com/desktop/install/windows-install/"
      echo "  After installing, enable WSL2 integration in Docker Desktop settings."
      exit 1
      ;;
    *)
      echo "  Please install Docker manually: https://docs.docker.com/get-docker/"
      exit 1
      ;;
  esac
}

if ! command -v docker &>/dev/null; then
  install_docker
fi

# Verify Docker daemon is running
if ! docker info &>/dev/null; then
  echo ""
  echo "  Docker daemon is not running."
  if [ "$OS" = "linux" ]; then
    echo "  Starting Docker daemon..."
    sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true
    sleep 2
    if ! docker info &>/dev/null; then
      echo "  Failed to start Docker. Please start it manually."
      exit 1
    fi
  else
    echo "  Please start Docker Desktop and re-run this script."
    exit 1
  fi
fi

echo "  Docker is ready."

# ── Pull image ────────────────────────────────────────────

echo ""
echo "  Pulling ${IMAGE}..."
docker pull "$IMAGE"

# ── Check for existing container ──────────────────────────

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "  Removing existing ${CONTAINER_NAME}..."
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

# ── Start container ───────────────────────────────────────

echo "  Starting ${CONTAINER_NAME}..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "${API_PORT}:3000" \
  -p "${VNC_PORT}:6080" \
  --shm-size=512m \
  -e DISPLAY=:1 \
  -e DESKTOP_MODE=full \
  -e COMPEEK_SESSION_NAME="Desktop 1" \
  --security-opt seccomp=unconfined \
  "$IMAGE" >/dev/null

# ── Wait for health ──────────────────────────────────────

echo "  Waiting for container to be ready..."
ELAPSED=0
while [ $ELAPSED -lt $HEALTH_TIMEOUT ]; do
  if curl -sf "http://localhost:${API_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

if [ $ELAPSED -ge $HEALTH_TIMEOUT ]; then
  echo "  Container did not become healthy. Check logs:"
  echo "    docker logs ${CONTAINER_NAME}"
  exit 1
fi

# ── Build connection string ──────────────────────────────

CONFIG_JSON="{\"name\":\"Desktop 1\",\"type\":\"compeek\",\"apiHost\":\"localhost\",\"apiPort\":${API_PORT},\"vncHost\":\"localhost\",\"vncPort\":${VNC_PORT}}"
CONFIG_B64=$(echo -n "$CONFIG_JSON" | base64 -w 0 2>/dev/null || echo -n "$CONFIG_JSON" | base64)

# ── Print results ────────────────────────────────────────

echo ""
echo "  ╔═══════════════════════════════════════╗"
echo "  ║       compeek is running!             ║"
echo "  ╚═══════════════════════════════════════╝"
echo ""
echo "  Dashboard:   ${DASHBOARD_URL}"
echo "  Quick link:  ${DASHBOARD_URL}/#config=${CONFIG_B64}"
echo ""
echo "  Tool API:    http://localhost:${API_PORT}"
echo "  noVNC:       http://localhost:${VNC_PORT}"
echo ""
echo "  Connection string:"
echo "  ${CONFIG_B64}"
echo ""
echo "  To stop:     docker rm -f ${CONTAINER_NAME}"
echo ""
