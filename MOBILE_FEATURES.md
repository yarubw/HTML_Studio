# Mobile features manual

This document describes **device-oriented helpers** in the Yarub HTML Playground: the **Mobile Features** panel in the editor and the **`mobile-features-lib.js`** script.

## 1. In the playground

1. Open **`index.html`** in the playground.
2. Click **Mobile Features** in the toolbar.
3. Pick a card (camera, microphone, GPS, QR, links, PWA snippets, etc.) and use **Insert Code** to paste a ready example into the current HTML file.

The playground also tries to load **`mobile-features-lib.js`** from the same folder as `index.html` so the library exists as a project file with the same APIs described below.

## 2. Using the library in your page

Add the script (paths relative to your HTML file):

```html
<script src="mobile-features-lib.js"></script>
```

Then call methods on the global **`MobileFeatures`** object, usually from `onclick` handlers.

**Requirements:** Many APIs need **HTTPS** (or `localhost`) and **user permission** (camera, mic, location). Behavior differs on phone vs desktop browsers.

## 3. `MobileFeatures` API

All methods accept an optional **params** object. Listed keys override the **default** shown in brackets.

### Camera

| Method | Purpose | Main params (defaults) |
|--------|---------|-------------------------|
| `start_camera` | Live video from camera | `videoId` [`cameraVideo`], `statusId` [`cameraStatus`], `key` [`camera`], `facingMode` [`environment`] |
| `start_back_camera` | Back / rear camera | Same as `start_camera` with `facingMode: 'environment'` |
| `start_front_camera` | Front / selfie camera | Same as `start_camera` with `facingMode: 'user'` |
| `switch_camera` | Toggle front ↔ back | `videoId`, `statusId`, `key` |
| `get_camera_facing` | Current facing mode | `key` [`camera`] → `'user'` or `'environment'` |
| `stop_camera` | Stop tracks | `key` [`camera`], `statusId` [`cameraStatus`] |
| `capture_image` | Frame from video → image | `videoId`, `canvasId` [`cameraCanvas`], `imageId` [`capturedImage`], `statusId`, `key`, `imageType` [`image/png`], `download` [`false`], `filename` |
| `download_image` | Save image to file | `dataUrl`, or `imageId`, or `canvasId`, or `key` (last capture), `filename`, `statusId` |
| `download_captured_image` | Save last capture for `key` | `key` [`camera`], `filename`, `statusId` |
| `load_image_from_input` | File input → image | `inputId` [`cameraInput`], `imageId`, `statusId`, `key`, `download`, `filename` |

**Android APK helpers** (only when running inside the exported WebView app):

| Method | Purpose |
|--------|---------|
| `is_android_app()` | `true` in the exported APK shell |
| `open_app_settings()` | Opens this app's page in Android Settings |
| `request_android_permission(kind)` | Request `camera`, `microphone`, or `location` |
| `has_android_permission(kind)` | Check if permission is granted (`true`/`false`, or `null` in browser) |
| `show_permission_dialog(params)` | HTML dialog with **Open Settings** and **Try again** buttons |

When camera/mic is denied, `start_camera` / `start_recording` show this dialog automatically (disable with `showDialog: false`).

Example:

```html
<button onclick="MobileFeatures.show_permission_dialog({ kind: 'camera' })">Camera settings</button>
<button onclick="MobileFeatures.open_app_settings()">Open app settings</button>
```

### Microphone (recording)

| Method | Purpose | Main params |
|--------|---------|--------------|
| `start_recording` | Start `MediaRecorder` | `statusId` [`micStatus`], `key` [`mic`] |
| `stop_recording` | Stop and build blob URL | `statusId`, `audioId` [`recordedAudio`], `downloadId` [`downloadAudioLink`], `key` [`mic`] |

### Geolocation

| Method | Purpose | Main params |
|--------|---------|--------------|
| `get_location` | One-shot position | `outputId` [`gpsOutput`] |
| `watch_location` | Continuous updates | `outputId`, `key` [`gps`] |
| `stop_watch_location` | Clear watch | `outputId`, `key` [`gps`] |

### QR code

| Method | Purpose | Main params |
|--------|---------|--------------|
| `scan_qr` | Decode from **file input** image or live camera frame | `videoId` [`qrVideo`], `canvasId` [`qrCanvas`], `resultId` [`qrResult`], `fileInputId` [`qrFileInput`], `key` [`qr`], `facingMode`, `captureDelayMs` [`800`], `invert`, `autoStop` [`true`] |

Decoding uses **`jsQR`** if it is loaded globally (`typeof jsQR === 'function'`). Snippets from **Mobile Features** that scan QR usually include the jsQR script—keep that pattern if you copy code elsewhere.

### Device links (deep links)

| Method | Behavior |
|--------|----------|
| `open_call(number)` | `tel:` |
| `open_sms(number)` | `sms:` |
| `open_email(address)` | `mailto:` |
| `open_map(lat, lng)` | Opens Google Maps in a new tab |
| `open_whatsapp(number, text)` | `wa.me` with optional message |
| `open_app_with_fallback(appUrl, webUrl, delayMs)` | Tries custom scheme, then web URL after delay |

### PWA helpers

| Method | Returns / behavior |
|--------|-------------------|
| `get_manifest_template()` | Pretty-printed JSON string for a sample **manifest.json** |
| `get_service_worker_template()` | Minimal **service worker** source string |
| `register_service_worker(file)` | Registers `./service-worker.js` or given path; returns `Promise<boolean>` |

## 4. Permissions and mobile tips

- Prefer **HTTPS** for camera, microphone, and geolocation.
- **`input type="file" accept="image/*"`** (and `capture` where appropriate) is a reliable fallback when `getUserMedia` is blocked or awkward on some devices.
- **QR**: ensure **canvas** and **video** (or file input) element ids match the params you pass, or use the defaults from the inserted snippet.

## 5. Files in this repo

| File | Role |
|------|------|
| `mobile-features-lib.js` | Implements `window.MobileFeatures` |
| `index.html` | UI for **Mobile Features** snippets and playground integration |

For general editor use, see **`README.md`**.
