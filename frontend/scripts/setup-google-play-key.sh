#!/bin/bash
# Wrapper script to handle EAS passing --platform argument
# EAS wraps commands with "npx expo" which tries to parse --platform,
# causing errors. This script calls node directly, bypassing npx expo.

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Filter out all command-line arguments (EAS may pass --platform, etc.)
# We completely ignore all arguments since the script only uses environment variables
# This prevents "unknown option: --platform" errors from npx expo

# Call the Node.js script directly with node (not through npx expo)
# exec replaces the bash process with node, completely bypassing any wrapper
exec node "$SCRIPT_DIR/setup-google-play-key.js"

