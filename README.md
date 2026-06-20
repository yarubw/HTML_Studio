# HTML Studio (Yarub HTML Playground)

Main editor: **`index.html`** (single-page app).

**Mobile Features** (camera, mic, GPS, QR, device links, PWA helpers): see **`MOBILE_FEATURES.md`**.

## Export APK (client-side — no server)

Open **`index.html`** in a browser (or serve the folder with any static host), click **Export APK**, enter an app name, pick an icon, then **Build APK**.

Everything runs in the browser:

1. Project files are injected into a WebView shell template (`vendor/webview-shell-base.apk`).
2. Launcher icons and app label are updated.
3. The APK is signed locally with **apksig WASM** (`vendor/apksig.wasm`).

Required static assets (ship with the repo):

| File | Purpose |
|------|---------|
| `vendor/webview-shell-base.apk` | Pre-built WebView shell |
| `vendor/apk-client-builder.js` | Repack + orchestration |
| `vendor/apksig.wasm` + `vendor/wasm_exec.js` | Browser APK signing ([apksig-go](https://github.com/agusibrahim/apksig-go)) |
| `vendor/yarub-debug.p12` | Debug signing keystore (password: `yarubhtml`) |
| `vendor/jszip.min.js` | ZIP read/write |

**Notes**

- Serves a **debug-signed** APK for sideloading/testing, not Play Store release.
- Launcher name is limited to **15 characters** (template slot in `resources.arsc`).
- First build may take ~10–30 seconds while WASM loads.
- Serve over **http(s)** (not `file://`) so WASM and template fetches work reliably.

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
