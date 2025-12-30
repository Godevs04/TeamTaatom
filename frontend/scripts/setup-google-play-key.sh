#!/bin/bash
# Wrapper script to handle EAS passing --platform argument
# This script filters out --platform and any value after it before calling the Node.js script

# Filter out --platform and its value from arguments
filtered_args=()
skip_next=false

for arg in "$@"; do
  if [ "$skip_next" = true ]; then
    skip_next=false
    continue
  fi
  
  if [ "$arg" = "--platform" ]; then
    skip_next=true
    continue
  fi
  
  filtered_args+=("$arg")
done

# Export environment variables to ensure they're available to the Node.js script
# EAS will set GOOGLE_PLAY_SERVICE_ACCOUNT_KEY, so we just need to pass it through
export GOOGLE_PLAY_SERVICE_ACCOUNT_KEY

# Call the Node.js script with filtered arguments (or no arguments)
# Environment variables are automatically inherited by child processes
node "$(dirname "$0")/setup-google-play-key.js" "${filtered_args[@]}"

