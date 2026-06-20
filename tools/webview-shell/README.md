# WebView shell (APK template)

Minimal Android WebView app used as the base for **client-side Export APK** in the HTML studio.

Student project files are injected into `assets/www/` in the browser; this project defines the native shell only.

## Build

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../../vendor/webview-shell-base.apk
```

The default launcher label in `resources.arsc` is **`HTML Studio App`** (15 characters). The browser builder patches that slot when exporting.

**Camera / mic / GPS:** The shell declares Android permissions and grants WebView `getUserMedia` / geolocation requests. Pages load over a **secure HTTPS origin** (`appassets.androidplatform.net`) so the camera API works. After changing this project, rebuild and copy the APK to `vendor/webview-shell-base.apk`, then **re-export** your app from the playground.
