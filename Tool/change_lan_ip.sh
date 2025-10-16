#!/bin/bash

# Function to get LAN IP automatically (Mac preferred)
auto_detect_ip() {
  # Try typical Mac network interface
  en0_ip=$(ipconfig getifaddr en0 2>/dev/null)
  if [[ $en0_ip =~ ^192\.168\..+ ]]; then
    echo "$en0_ip"
    return 0
  fi
  # Try all interfaces for a 192.168 or 10.x IP
  ip=$(ifconfig | grep -Eo 'inet (192\.168\.[0-9.]+|10\.[0-9.]+)' | awk '{print $2}' | head -n1)
  if [ -n "$ip" ]; then
    echo "$ip"
    return 0
  fi
  # Fallback: try hostname-based lookup
  ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo "$ip"
}

# MAIN
USER_IP="$1"
if [ -z "$USER_IP" ]; then
  USER_IP=$(auto_detect_ip)
  if [ -z "$USER_IP" ]; then
    echo "ERROR: Could not auto-detect LAN IP. Please specify it manually: $0 <LAN_IP>"
    exit 1
  fi
  echo "Auto-detected LAN IP: $USER_IP"
else
  echo "Using user-supplied LAN IP: $USER_IP"
fi

NEW_IP="$USER_IP"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Update frontend/app.json
FRONTEND_JSON="$ROOT_DIR/../frontend/app.json"
if [ -f "$FRONTEND_JSON" ]; then
  echo "Updating frontend/app.json API_BASE_URL..."
  if command -v jq > /dev/null; then
    jq --arg ip "$NEW_IP" '(.expo.extra.API_BASE_URL) |= "http://\($ip):3000"' "$FRONTEND_JSON" > "$FRONTEND_JSON.tmp" && mv "$FRONTEND_JSON.tmp" "$FRONTEND_JSON"
  else
    sed -i '' -E "s|(\"API_BASE_URL\"\:\ \"http\://)[0-9.]+(:3000\")|\1$NEW_IP\2|" "$FRONTEND_JSON"
  fi
else
  echo "frontend/app.json not found"
fi

# Update frontend/.env
FRONTEND_ENV="$ROOT_DIR/../frontend/.env"
if [ -f "$FRONTEND_ENV" ]; then
  echo "Updating frontend/.env API_BASE_URL and EXPO_PUBLIC_API_BASE_URL..."
  sed -i '' -E "s|^(API_BASE_URL=)http://[0-9A-Za-z\.-]+(:[0-9]+)|\1http://$NEW_IP\2|" "$FRONTEND_ENV"
  sed -i '' -E "s|^(EXPO_PUBLIC_API_BASE_URL[ ]*=)[ ]*http://[0-9A-Za-z\.-]+(:[0-9]+)|\1 http://$NEW_IP\2|" "$FRONTEND_ENV"
else
  echo "frontend/.env not found"
fi

# Update backend/environment.env (active and commented lines)
BACKEND_ENV="$ROOT_DIR/../backend/environment.env"
if [ -f "$BACKEND_ENV" ]; then
  echo "Updating backend/environment.env API_BASE_URL and FRONTEND_URL (active and comments)..."
  sed -i '' -E "s|^(API_BASE_URL=http://)[0-9.]+(:3000)$|\1$NEW_IP\2|" "$BACKEND_ENV"
  sed -i '' -E "s|^(FRONTEND_URL=http://)[0-9.]+(:8081)$|\1$NEW_IP\2|" "$BACKEND_ENV"
  sed -i '' -E "s|^(#API_BASE_URL=http://)[0-9.]+(:3000)$|\1$NEW_IP\2|" "$BACKEND_ENV"
  sed -i '' -E "s|^(#FRONTEND_URL=http://)[0-9.]+(:8081)$|\1$NEW_IP\2|" "$BACKEND_ENV"
else
  echo "backend/environment.env not found"
fi

# Update backend/env.example FRONTEND_URL
BACKEND_ENV_EX="$ROOT_DIR/../backend/env.example"
if [ -f "$BACKEND_ENV_EX" ]; then
  echo "Updating backend/env.example FRONTEND_URL..."
  sed -i '' -E "s|^(FRONTEND_URL=http://)[^:]+(:8081)$|\1$NEW_IP\2|" "$BACKEND_ENV_EX"
else
  echo "backend/env.example not found"
fi

echo "LAN IP updated to $NEW_IP everywhere (frontend/app.json, frontend/.env, backend/environment.env, backend/env.example)."
