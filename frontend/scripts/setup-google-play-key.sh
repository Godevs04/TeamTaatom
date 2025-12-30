#!/bin/bash
# Wrapper script to handle EAS passing --platform argument
# EAS wraps commands with "npx expo" which tries to parse --platform,
# causing errors. This script calls node directly, bypassing npx expo.

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Call the Node.js script directly with node (not through npx expo)
# We ignore all arguments since the script only uses environment variables
exec node "$SCRIPT_DIR/setup-google-play-key.js"

