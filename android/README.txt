COMMON AREA - Android app (APK)

What the app does
  - Opens the live game (https://common-area.onrender.com): multiplayer, friends, always the newest version.
  - With no internet, or when the player taps "Play offline instead", it opens the copy of the game packed
    inside the app: solo play with computer villagers, saved on the phone.
  - The phone's Back button opens a small menu: keep playing / online / offline / exit.

Rebuild (after the game changed, so the offline copy is fresh)
    bash android/build.sh
  The result is android/CommonArea.apk. Each build gets a higher version number, so it installs over the old one.

What is where
  AndroidManifest.xml, res/        app name, icon, colours
  src/.../MainActivity.java        the whole app: one web view (addresses are at the top of the file)
  build.sh                         builds without Android Studio or Gradle
  keystore/                        the signing key and its password, made by the first build. It is NOT in the
                                   Git repository (.gitignore). KEEP IT, AND KEEP IT PRIVATE: a phone only accepts
                                   an update signed with the same key.
  ~/android-tools                  where build.sh expects the tools: Temurin JDK 17 in jdk/, and an Android SDK in sdk/
                                   with build-tools 34.0.0 and platform android-34 (set ANDROID_TOOLS to use another
                                   folder; its path must not contain spaces)

Limits
  - Android 8.0 or newer.
  - Phones stay upright (the game's layout is too tall for a phone held sideways); tablets can turn.
  - Signed with our own key: fine for sending the file to friends ("install unknown apps" must be allowed),
    not ready for the Play Store (that needs a Google developer account and an .aab upload).
  - The "Download" button for an astrology reading does nothing inside the app (use the website for that).
  - If the live game's address changes, edit ONLINE_HOST in MainActivity.java and rebuild.
