#!/usr/bin/env bash
# Rebuild the Android APK for the technician app.
# Usage:  bash build-apk.sh [API_BASE]
#   API_BASE — backend URL baked into the build (default: PC LAN IP below).
#   For live mode the phone must reach this URL; Demo Login always works offline.
set -e
cd "$(dirname "$0")"

# Default to the live Render backend. It used to default to a LAN IP, which
# produced APKs that only worked on one home network — pass a URL explicitly to
# build against a local server instead.
API_BASE="${1:-https://oasis-service-automation.onrender.com}"
# Toolchain lives on D: — a self-contained JDK 17 + Android SDK, not a system
# install, so nothing here depends on Android Studio being present.
# AGP 8.2.1 requires JDK 17 specifically; 21 will not build this project.
export ANDROID_HOME="${ANDROID_HOME:-D:/dev-tools/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="${JAVA_HOME:-D:/dev-tools/jdk17}"
export PATH="$JAVA_HOME/bin:$PATH"

echo "Building web (VITE_API_BASE=$API_BASE) ..."
VITE_API_BASE="$API_BASE" npm run build

echo "Syncing to Android project ..."
npx cap copy android

echo "Assembling debug APK ..."
( cd android && ./gradlew assembleDebug --no-daemon )

cp android/app/build/outputs/apk/debug/app-debug.apk Oasis-Technician.apk
echo "Done -> technician-app/Oasis-Technician.apk"
