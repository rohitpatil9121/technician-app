#!/usr/bin/env bash
# Rebuild the Android APK for the technician app.
# Usage:  bash build-apk.sh [API_BASE]
#   API_BASE — backend URL baked into the build (default: PC LAN IP below).
#   For live mode the phone must reach this URL; Demo Login always works offline.
set -e
cd "$(dirname "$0")"

API_BASE="${1:-http://192.168.1.36:3000}"
export ANDROID_HOME="C:/Android/Sdk"
export JAVA_HOME="C:/Android/jdk17-tmp/jdk-17.0.19+10"
export PATH="$JAVA_HOME/bin:$PATH"

echo "Building web (VITE_API_BASE=$API_BASE) ..."
VITE_API_BASE="$API_BASE" npm run build

echo "Syncing to Android project ..."
npx cap copy android

echo "Assembling debug APK ..."
( cd android && ./gradlew assembleDebug --no-daemon )

cp android/app/build/outputs/apk/debug/app-debug.apk Oasis-Technician.apk
echo "Done -> technician-app/Oasis-Technician.apk"
