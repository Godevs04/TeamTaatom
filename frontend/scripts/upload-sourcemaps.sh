#!/bin/bash

# Sentry Source Maps Upload Script
# This script uploads source maps to Sentry after a production build
# Used by EAS Build hooks and CI/CD pipelines

set -e

echo "🔍 Checking Sentry configuration..."

# Check if Sentry auth token is set
if [ -z "$SENTRY_AUTH_TOKEN" ]; then
  echo "⚠️  SENTRY_AUTH_TOKEN not found. Source maps will not be uploaded."
  echo "   Set SENTRY_AUTH_TOKEN in CI/CD secrets or build environment."
  exit 0
fi

# Check if Sentry org and project are set
if [ -z "$SENTRY_ORG" ]; then
  echo "⚠️  SENTRY_ORG not found. Using default from Sentry config."
  SENTRY_ORG="${SENTRY_ORG:-@teamgodevs}"
fi

if [ -z "$SENTRY_PROJECT" ]; then
  echo "⚠️  SENTRY_PROJECT not found. Using default from Sentry config."
  SENTRY_PROJECT="${SENTRY_PROJECT:-taatom}"
fi

# Get release version from EAS build or use git SHA
RELEASE="${EAS_BUILD_ID:-${GITHUB_SHA:-$(git rev-parse HEAD)}}"

echo "📦 Uploading source maps to Sentry..."
echo "   Organization: $SENTRY_ORG"
echo "   Project: $SENTRY_PROJECT"
echo "   Release: $RELEASE"

# Install Sentry CLI if not available
if ! command -v sentry-cli &> /dev/null; then
  echo "📥 Installing Sentry CLI..."
  npm install -g @sentry/cli || {
    echo "❌ Failed to install Sentry CLI"
    exit 1
  }
fi

# Find source maps directory
SOURCE_MAPS_DIR=""
if [ -d "dist" ]; then
  SOURCE_MAPS_DIR="dist"
elif [ -d ".expo/web/dist" ]; then
  SOURCE_MAPS_DIR=".expo/web/dist"
elif [ -d "build" ]; then
  SOURCE_MAPS_DIR="build"
else
  echo "⚠️  Source maps directory not found. Skipping upload."
  echo "   Searched: dist, .expo/web/dist, build"
  exit 0
fi

echo "📁 Source maps directory: $SOURCE_MAPS_DIR"

# Upload source maps
sentry-cli sourcemaps upload \
  --org "$SENTRY_ORG" \
  --project "$SENTRY_PROJECT" \
  --release "$RELEASE" \
  "$SOURCE_MAPS_DIR" || {
    echo "⚠️  Source maps upload failed. Continuing build..."
    exit 0
  }

echo "✅ Source maps uploaded successfully!"
echo "   Release: $RELEASE"
echo "   View in Sentry: https://sentry.io/organizations/$SENTRY_ORG/releases/$RELEASE/"

