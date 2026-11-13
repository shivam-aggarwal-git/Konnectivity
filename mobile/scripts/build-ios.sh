#!/bin/bash
set -euo pipefail
mobile_root="$(cd "$(dirname "$0")/.." && pwd)"
mobile_output="$mobile_root/artifacts"
mobile_stage="$(mktemp -d "${TMPDIR:-/tmp}/konnectivity-ipa.XXXXXX")"
trap 'rm -rf "$mobile_stage"' EXIT
mobile_app="$mobile_stage/Payload/Konnectivity.app"
mkdir -p "$mobile_app" "$mobile_output"
mobile_sdk="$(xcrun --sdk iphoneos --show-sdk-path)"
xcrun --sdk iphoneos swiftc -sdk "$mobile_sdk" -target arm64-apple-ios17.0 -parse-as-library -O \
 -framework SwiftUI -framework WebKit -framework AVFoundation -framework UIKit -framework Foundation \
 "$mobile_root/ios/Konnectivity/KonnectivityApp.swift" -o "$mobile_app/Konnectivity"
python3 - "$mobile_root" "$mobile_app" <<'PY'
import sys,plistlib,shutil
from pathlib import Path
root,app=map(Path,sys.argv[1:]);info=plistlib.loads((root/'ios/Konnectivity/Info.plist').read_bytes())
info.update(CFBundleIdentifier='com.konnectivity.privateapp',CFBundleExecutable='Konnectivity',CFBundleSupportedPlatforms=['iPhoneOS'],MinimumOSVersion='17.0',UIDeviceFamily=[1,2],DTPlatformName='iphoneos')
(app/'Info.plist').write_bytes(plistlib.dumps(info,fmt=plistlib.FMT_BINARY))
for icon in (root/'ios/Konnectivity').glob('Icon*.png'):shutil.copy2(icon,app/icon.name)
PY
python3 - "$mobile_stage" "$mobile_output/Konnectivity-10.06.1-unsigned.ipa" <<'PYZIP'
import sys,zipfile
from pathlib import Path
stage=Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED) as archive:
 for entry in (stage/'Payload').rglob('*'):
  if entry.is_file(): archive.write(entry,entry.relative_to(stage))
PYZIP
echo "IPA for AltStore/SideStore: $mobile_output/Konnectivity-10.06.1-unsigned.ipa"
