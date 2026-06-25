# HTML Studio (Yarub HTML Playground)

Main editor: **`index.html`** (single-page app).

**Mobile Features** (camera, mic, GPS, QR, device links, PWA helpers): see **`MOBILE_FEATURES.md`**.

## Export APK (client-side — no server)

Open **`index.html`** in a browser (or serve the folder with any static host), click **Export APK**, then **Build APK**. Defaults: app name **test**, package **com.yarub.test**, icon **default.jpg**.

Everything runs in the browser:

1. Project files are injected into a WebView shell template (`vendor/webview-shell-base.apk`).
2. Launcher icons, app label, and package name are updated.
3. The APK is signed locally with **apksig WASM** (`vendor/apksig.wasm`).

Required static assets (ship with the repo):

| File | Purpose |
|------|---------|
| `vendor/webview-shell-base.apk` | Pre-built WebView shell |
| `vendor/apk-client-builder.js` | Repack + orchestration |
| `vendor/apksig.wasm` + `vendor/wasm_exec.js` | Browser APK signing ([apksig-go](https://github.com/agusibrahim/apksig-go)) |
| `vendor/yarub-debug.p12` | Debug signing keystore (password: `yarubhtml`) |
| `vendor/jszip.min.js` | ZIP read/write |
| `default.jpg` | Default launcher icon for Export APK |

**Notes**

- Serves a **debug-signed** APK for sideloading/testing, not Play Store release.
- Launcher name is limited to **15 characters** (template slot in `resources.arsc`).
- Package names shorter than 20 characters are auto-padded in the APK (e.g. `com.yarub.test` → `com.yarub.test.appaa`).
- First build may take ~10–30 seconds while WASM loads.
- Serve over **http(s)** (not `file://`) so WASM and template fetches work reliably.

## Export Web App (PWA — client-side)

Click **Export Web App** in the toolbar, set the app name and icon (defaults: **test**, **default.jpg**), then **Download Web App**.

The zip includes:

1. Your project files (with PWA tags injected into `index.html`)
2. `manifest.json` (app name + icons)
3. `icons/icon-192.png` and `icons/icon-512.png`
4. `service-worker.js` (basic offline cache)

Deploy by uploading the unzipped folder to any **HTTPS** web host, then on iPhone/Android use **Add to Home Screen**.

| File | Purpose |
|------|---------|
| `vendor/webapp-export.js` | PWA zip builder |
| `default.jpg` | Default launcher icon |

---

### Rebuild the WebView shell template (optional)

If you change the native shell under `tools/webview-shell/`:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
cd tools/webview-shell
./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../../vendor/webview-shell-base.apk
```

---

## Optional: server-side APK (GitHub Actions)

The Node service in **`server/`** still exists for CI-based builds — see **`server/README.md`**.

```bash
cd server
npm install
cp .env.example .env
# Set GITHUB_TOKEN (repo + workflow permissions)
npm run dev
```

**Mobile builds (Capacitor + GitHub Actions APK / iOS):** Node service **`mobile-sync-backend/`** — see **`mobile-sync-backend/README.md`** and **`mobile-sync-backend/MANUAL.md`**.
