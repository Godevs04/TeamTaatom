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
  echo "Updating frontend/app.json API_BASE_URL and WEB_SHARE_URL..."
  if command -v jq > /dev/null; then
    jq --arg ip "$NEW_IP" '(.expo.extra.API_BASE_URL) |= "http://\($ip):3000" | (.expo.extra.WEB_SHARE_URL) |= "http://\($ip):3000"' "$FRONTEND_JSON" > "$FRONTEND_JSON.tmp" && mv "$FRONTEND_JSON.tmp" "$FRONTEND_JSON"
  else
    sed -i '' -E "s|(\"API_BASE_URL\"\:\ \"http\://)[0-9.]+(:3000\")|\1$NEW_IP\2|" "$FRONTEND_JSON"
    sed -i '' -E "s|(\"WEB_SHARE_URL\"\:\ \"http\://)[0-9.]+(:3000\")|\1$NEW_IP\2|" "$FRONTEND_JSON"
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

# Update backend/.env (primary backend configuration)
BACKEND_DOT_ENV="$ROOT_DIR/../backend/.env"
if [ -f "$BACKEND_DOT_ENV" ]; then
  echo "Updating backend/.env FRONTEND_URL, WEB_FRONTEND_URL, API_BASE_URL and SUPERADMIN_URL..."
  sed -i '' -E "s|^(FRONTEND_URL=http://)[0-9.]+(:8081)$|\1$NEW_IP\2|" "$BACKEND_DOT_ENV"
  sed -i '' -E "s|^(WEB_FRONTEND_URL=http://)[0-9.]+(:3001)$|\1$NEW_IP\2|" "$BACKEND_DOT_ENV"
  sed -i '' -E "s|^(API_BASE_URL=http://)[0-9.]+(:3000)$|\1$NEW_IP\2|" "$BACKEND_DOT_ENV"
  sed -i '' -E "s|^(SUPERADMIN_URL=http://)[0-9.]+(:5001)$|\1$NEW_IP\2|" "$BACKEND_DOT_ENV"
else
  echo "backend/.env not found"
fi

# Update backend/environment.env (legacy / sample config, active and commented lines)
BACKEND_ENV="$ROOT_DIR/../backend/.env"
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
BACKEND_ENV_EX="$ROOT_DIR/../backend/.env"
if [ -f "$BACKEND_ENV_EX" ]; then
  echo "Updating backend/env.example FRONTEND_URL..."
  sed -i '' -E "s|^(FRONTEND_URL=http://)[^:]+(:8081)$|\1$NEW_IP\2|" "$BACKEND_ENV_EX"
else
  echo "backend/env.example not found"
fi

# Update backend/src/app.js CORS allowed origins
BACKEND_APP_JS="$ROOT_DIR/../backend/src/app.js"
if [ -f "$BACKEND_APP_JS" ]; then
  echo "Updating backend/src/app.js CORS allowed origins..."
  # Replace IP addresses in CORS origins array (both :8081 and :3000)
  # Pattern: 'http://192.168.x.x:8081' or 'http://192.168.x.x:3000'
  sed -i '' -E "s|('http://)192\.168\.[0-9]+\.[0-9]+(:8081')|\1$NEW_IP\2|g" "$BACKEND_APP_JS"
  sed -i '' -E "s|('http://)192\.168\.[0-9]+\.[0-9]+(:3000')|\1$NEW_IP\2|g" "$BACKEND_APP_JS"
  # Also handle double-quoted strings
  sed -i '' -E "s|(\"http://)192\.168\.[0-9]+\.[0-9]+(:8081\")|\1$NEW_IP\2|g" "$BACKEND_APP_JS"
  sed -i '' -E "s|(\"http://)192\.168\.[0-9]+\.[0-9]+(:3000\")|\1$NEW_IP\2|g" "$BACKEND_APP_JS"
else
  echo "backend/src/app.js not found"
fi

# Update superAdmin/.env VITE_API_URL
SUPERADMIN_ENV="$ROOT_DIR/../superAdmin/.env"
if [ -f "$SUPERADMIN_ENV" ]; then
  echo "Updating superAdmin/.env VITE_API_URL..."
  sed -i '' -E "s|^(VITE_API_URL=http://)[0-9.]+(:3000)$|\1$NEW_IP\2|" "$SUPERADMIN_ENV"
else
  echo "superAdmin/.env not found"
fi

# Update web/.env.local BACKEND_ORIGIN and NEXT_PUBLIC_WEB_URL
WEB_ENV_LOCAL="$ROOT_DIR/../web/.env.local"
if [ -f "$WEB_ENV_LOCAL" ]; then
  echo "Updating web/.env.local BACKEND_ORIGIN and NEXT_PUBLIC_WEB_URL..."
  sed -i '' -E "s|^(BACKEND_ORIGIN=)http://[0-9.]+(:3000)(.*)$|\1http://$NEW_IP\2\3|" "$WEB_ENV_LOCAL"
  sed -i '' -E "s|^(NEXT_PUBLIC_WEB_URL=)http://[0-9.]+(:3001)(.*)$|\1http://$NEW_IP\2\3|" "$WEB_ENV_LOCAL"
else
  echo "web/.env.local not found"
fi

echo "LAN IP updated to $NEW_IP across frontend, backend, superAdmin, and web configs."
