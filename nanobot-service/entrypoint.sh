#!/usr/bin/env bash
set -euo pipefail

CONFIG_PATH="/data/nanobot/config/config.json"
WORKSPACE_PATH="/data/nanobot/workspace"
DEFAULT_SKILLS_PATH="/opt/nanobot/custom_skills"
MOUNTED_SKILLS_PATH="/data/nanobot/custom_skills"
TARGET_SKILLS_PATH="${WORKSPACE_PATH}/skills"

mkdir -p "${WORKSPACE_PATH}" "${TARGET_SKILLS_PATH}" "/data/nanobot/config"

# 1) Seed image-bundled skills.
if [ -d "${DEFAULT_SKILLS_PATH}" ]; then
  cp -f "${DEFAULT_SKILLS_PATH}"/*.py "${TARGET_SKILLS_PATH}"/ 2>/dev/null || true
fi

# 2) Override/update with host-mounted skills.
if [ -d "${MOUNTED_SKILLS_PATH}" ]; then
  cp -f "${MOUNTED_SKILLS_PATH}"/*.py "${TARGET_SKILLS_PATH}"/ 2>/dev/null || true
fi

# Install Node.js dependencies if needed
if [ ! -d "/opt/nanobot/node_modules" ]; then
  echo "📦 Installing WhatsApp bridge dependencies..."
  cd /opt/nanobot
  npm install --production
fi

# Start WhatsApp bridge in background
echo "🚀 Starting WhatsApp bridge..."
cd /opt/nanobot
node whatsapp-bridge.js &
BRIDGE_PID=$!

# Wait a moment for bridge to start
sleep 2

# Start nanobot gateway
echo "🐈 Starting nanobot gateway..."
nanobot gateway --config "${CONFIG_PATH}" --workspace "${WORKSPACE_PATH}" &
NANOBOT_PID=$!

# Handle shutdown gracefully
trap "kill $BRIDGE_PID $NANOBOT_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# Wait for both processes
wait $NANOBOT_PID
