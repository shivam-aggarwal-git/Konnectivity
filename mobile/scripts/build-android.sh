#!/bin/bash
set -euo pipefail
mobile_root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -z "${JAVA_HOME:-}" && -d '/Applications/Android Studio.app/Contents/jbr/Contents/Home' ]]; then
 export JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home'
fi
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
if [[ ! -d "$ANDROID_HOME/platforms/android-35" ]]; then
 echo 'Android SDK platform 35 is required to rebuild (not to install the APK).' >&2; exit 1
fi
cd "$mobile_root/android"
./gradlew assembleRelease
mkdir -p "$mobile_root/artifacts"
cp app/build/outputs/apk/release/app-release.apk "$mobile_root/artifacts/Konnectivity-10.06.1-android.apk"
echo "APK: $mobile_root/artifacts/Konnectivity-10.06.1-android.apk"
