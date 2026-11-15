#!/bin/bash
# Builds CommonArea.apk from this folder + the game's web files (../public).
#   bash android/build.sh    -> android/CommonArea.apk   (OUT=/some/where/CommonArea.apk to put it elsewhere)
# Needs the tools in ~/android-tools (JDK 17 + Android SDK build-tools 34.0.0 + platform android-34).
# No Gradle: resources with aapt2, code with javac + d8, then zipalign and apksigner.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
GAME="$HERE/../public"
OUT="${OUT:-$HERE/CommonArea.apk}"
TOOLS="${ANDROID_TOOLS:-$HOME/android-tools}"
export JAVA_HOME="$(ls -d "$TOOLS"/jdk/*/Contents/Home | head -1)"
BT="$TOOLS/sdk/build-tools/34.0.0"
JAR="$TOOLS/sdk/platforms/android-34/android.jar"
VERSION_NAME="${VERSION_NAME:-1.0}"
VERSION_CODE="${VERSION_CODE:-$(date +%y%m%d%H)}"   # grows with time, so a newer build always installs over an older one
B="$TOOLS/build/common-area"                          # work folder without spaces in its path
KS="$HERE/keystore/common-area.jks"
KSPASS="$HERE/keystore/password.txt"

[ -f "$GAME/index.html" ] || { echo "Game files not found at $GAME"; exit 1; }
if [ ! -f "$KS" ]; then   # the signing key: made once; every later build must use the same file, or phones refuse the update
  mkdir -p "$HERE/keystore"
  openssl rand -hex 16 | tr -d '\n' > "$KSPASS"; chmod 600 "$KSPASS"
  "$JAVA_HOME/bin/keytool" -genkeypair -keystore "$KS" -storepass:file "$KSPASS" -keypass:file "$KSPASS" -alias common-area \
    -keyalg RSA -keysize 2048 -validity 10950 -dname "CN=Common Area" >/dev/null 2>&1
  echo "Made a new signing key in keystore/ (keep this folder safe and private)"
fi

rm -rf "$B"; mkdir -p "$B/src" "$B/gen" "$B/classes" "$B/dex" "$B/assets/www"
cp -R "$HERE/res" "$B/res"; cp "$HERE/AndroidManifest.xml" "$B/"; cp -R "$HERE/src/." "$B/src/"
rsync -a --exclude .DS_Store "$GAME/" "$B/assets/www/"

"$BT/aapt2" compile --dir "$B/res" -o "$B/res.zip"
"$BT/aapt2" link -o "$B/app.unsigned.apk" -I "$JAR" --manifest "$B/AndroidManifest.xml" -A "$B/assets" --java "$B/gen" \
  --min-sdk-version 26 --target-sdk-version 34 --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" "$B/res.zip"
"$JAVA_HOME/bin/javac" -nowarn --release 8 -Xlint:-options -cp "$JAR" -d "$B/classes" $(find "$B/src" "$B/gen" -name '*.java')
"$BT/d8" --release --lib "$JAR" --min-api 26 --output "$B/dex" $(find "$B/classes" -name '*.class')
(cd "$B/dex" && zip -q -j "$B/app.unsigned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$B/app.unsigned.apk" "$B/app.aligned.apk"
"$BT/apksigner" sign --ks "$KS" --ks-pass "file:$KSPASS" --ks-key-alias common-area --out "$B/CommonArea.apk" "$B/app.aligned.apk"
"$BT/apksigner" verify "$B/CommonArea.apk"
cp "$B/CommonArea.apk" "$OUT"
echo "Built $OUT  (version $VERSION_NAME, code $VERSION_CODE, $(du -h "$B/CommonArea.apk" | cut -f1))"
