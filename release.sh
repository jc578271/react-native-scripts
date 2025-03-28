#!/bin/bash

# React Native Build Script
# This script builds both Android and iOS apps for release
# It should be run after prepare/main.js

set -e # Exit on error

# Get the directory of the current script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Default values
DEFAULT_CONFIG_FILE="./build.config.json"
DEFAULT_PLATFORM="all"
DEFAULT_IOS_PROJECT_NAME="MyApp"

# Function to parse JSON file
parse_json() {
  local file="$1"
  local key="$2"

  if [ -f "$file" ]; then
    value=$(grep -o "\"$key\":[^,}]*" "$file" | awk -F: '{print $2}' | tr -d ' "')
    if [ -n "$value" ]; then
      echo "$value"
      return 0
    fi
  fi
  return 1
}

# Function to load config from file
load_config() {
  local config_file="$1"

  if [ ! -f "$config_file" ]; then
    echo "Error: Config file $config_file not found!"
    exit 1
  fi

  echo "Loading configuration from $config_file..."

  # Parse only the configuration needed for building
  PLATFORM=$(parse_json "$config_file" "platform" || echo "$DEFAULT_PLATFORM")
  IOS_PROJECT_NAME=$(parse_json "$config_file" "ios_project_name" || echo "$DEFAULT_IOS_PROJECT_NAME")

  echo "Configuration loaded successfully."
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --file)
      CONFIG_FILE="$2"
      shift 2
      ;;
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    --ios-project)
      IOS_PROJECT_NAME="$2"
      shift 2
      ;;
    --help)
      echo "Usage: ./build.sh [options]"
      echo "Options:"
      echo "  --file           Path to configuration file (default: $DEFAULT_CONFIG_FILE)"
      echo "  --platform       Platform to build for: 'ios', 'android', or 'all' (overrides config file)"
      echo "  --ios-project    iOS project name (overrides config file)"
      echo "  --help           Show this help message"
      echo ""
      echo "Note: This script will automatically run prepare/main.js before building"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for available options."
      exit 1
      ;;
  esac
done

# Use default config file if not specified
CONFIG_FILE=${CONFIG_FILE:-$DEFAULT_CONFIG_FILE}

# Load configuration from file
load_config "$CONFIG_FILE"

# Function to build iOS app
build_ios() {
  echo "Building iOS app for Archive..."

  cd ios

  # Create an archive and open the Xcode organizer
  xcodebuild -workspace $IOS_PROJECT_NAME.xcworkspace -scheme $IOS_PROJECT_NAME -configuration Release \
    -archivePath build/$IOS_PROJECT_NAME.xcarchive archive -allowProvisioningUpdates

  # Open Xcode with the archive
  echo "Opening Xcode organizer with the archive..."
  open -a Xcode build/$IOS_PROJECT_NAME.xcarchive

  cd ..

  echo "iOS build completed. The Archive window should be open in Xcode."
}

# Function to build Android app
build_android() {
  echo "Building Android app bundle (AAB)..."

  cd android

  # Build for store distribution (Google Play)
  echo "Creating AAB for Google Play Store..."
  ./gradlew clean

   echo "Bundling release..."
  ./gradlew bundleRelease

  echo "AAB build completed successfully."
  echo "App Bundle location: android/app/build/outputs/bundle/release/app-release.aab"
  open android/app/build/outputs/bundle/release

  cd ..
}

# Main execution
echo "React Native Build Script"
echo "========================="
echo "Building for platform: $PLATFORM"
echo "iOS Project Name: $IOS_PROJECT_NAME"
echo "========================="

# Execute prepare/main.js before building
echo "Running prepare script first..."

# Determine the prepare script path relative to this script's location
PREPARE_SCRIPT="$SCRIPT_DIR/prepare/main.js"

if [ -f "$PREPARE_SCRIPT" ]; then
  echo "Executing $PREPARE_SCRIPT"
  node "$PREPARE_SCRIPT" --file "$CONFIG_FILE" --autoVersionCode 1
  if [ $? -ne 0 ]; then
    echo "Error: Prepare script failed. Build process aborted."
    exit 1
  fi
  echo "Prepare script completed successfully."
else
  echo "Error: prepare/main.js script not found at $PREPARE_SCRIPT! Please ensure it exists in the prepare directory."
  exit 1
fi

# Build apps
if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "all" ]]; then
  build_ios
fi

if [[ "$PLATFORM" == "android" || "$PLATFORM" == "all" ]]; then
  build_android
fi

echo "Build process completed!"
