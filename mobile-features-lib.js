/* MobileFeatures Library
 * Student-facing API with simple method calls.
 */
(function (global) {
  const state = {
    streams: {},
    recorders: {},
    chunks: {},
    watchIds: {},
    cameraFacing: {},
    captures: {}
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    const el = byId(id);
    if (el) el.textContent = text;
  }

  function isAndroidApp() {
    return typeof global.HtmlStudioAndroid !== "undefined"
      && typeof global.HtmlStudioAndroid.isAndroidApp === "function"
      && global.HtmlStudioAndroid.isAndroidApp();
  }

  function open_app_settings() {
    if (isAndroidApp() && typeof global.HtmlStudioAndroid.openAppSettings === "function") {
      global.HtmlStudioAndroid.openAppSettings();
      return true;
    }
    return false;
  }

  function request_android_permission(kind) {
    if (!isAndroidApp()) return false;
    const bridge = global.HtmlStudioAndroid;
    if (kind === "camera" && typeof bridge.requestCameraPermission === "function") {
      bridge.requestCameraPermission();
      return true;
    }
    if (kind === "microphone" && typeof bridge.requestMicrophonePermission === "function") {
      bridge.requestMicrophonePermission();
      return true;
    }
    if (kind === "location" && typeof bridge.requestLocationPermission === "function") {
      bridge.requestLocationPermission();
      return true;
    }
    return false;
  }

  function has_android_permission(kind) {
    if (!isAndroidApp()) return null;
    const bridge = global.HtmlStudioAndroid;
    if (kind === "camera" && typeof bridge.hasCameraPermission === "function") {
      return bridge.hasCameraPermission();
    }
    if (kind === "microphone" && typeof bridge.hasMicrophonePermission === "function") {
      return bridge.hasMicrophonePermission();
    }
    if (kind === "location" && typeof bridge.hasLocationPermission === "function") {
      return bridge.hasLocationPermission();
    }
    return null;
  }

  function show_permission_dialog(params = {}) {
    const kind = params.kind || "camera";
    const overlayId = params.overlayId || "mf-permission-dialog";
    const title = params.title || (kind.charAt(0).toUpperCase() + kind.slice(1) + " permission needed");
    const message = params.message
      || ("Allow " + kind + " access for this app. Open Android Settings to enable the permission.");
    const existing = byId(overlayId);
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = overlayId;
    overlay.setAttribute("role", "dialog");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;";
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:12px;max-width:360px;width:100%;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.2);font-family:Segoe UI,Arial,sans-serif;">' +
      '<h3 style="margin:0 0 10px;font-size:18px;">' + title + '</h3>' +
      '<p style="margin:0 0 16px;color:#374151;line-height:1.5;font-size:14px;">' + message + '</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;">' +
      '<button type="button" data-mf-action="cancel" style="padding:8px 12px;border:1px solid #d1d5db;background:#fff;border-radius:8px;">Cancel</button>' +
      (params.showRetry !== false ? '<button type="button" data-mf-action="retry" style="padding:8px 12px;border:none;background:#2563eb;color:#fff;border-radius:8px;">Try again</button>' : '') +
      (isAndroidApp() ? '<button type="button" data-mf-action="settings" style="padding:8px 12px;border:none;background:#7c3aed;color:#fff;border-radius:8px;">Open Settings</button>' : '') +
      '</div></div>';

    function closeDialog() {
      overlay.remove();
    }

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeDialog();
    });
    overlay.querySelector('[data-mf-action="cancel"]').addEventListener("click", closeDialog);
    const retryBtn = overlay.querySelector('[data-mf-action="retry"]');
    if (retryBtn) {
      retryBtn.addEventListener("click", function () {
        closeDialog();
        if (typeof params.onRetry === "function") params.onRetry();
        else request_android_permission(kind);
      });
    }
    const settingsBtn = overlay.querySelector('[data-mf-action="settings"]');
    if (settingsBtn) {
      settingsBtn.addEventListener("click", function () {
        open_app_settings();
        closeDialog();
      });
    }
    document.body.appendChild(overlay);
    return overlay;
  }

  function defaultPhotoFilename(ext) {
    const extension = (ext || "png").replace(/^\./, "");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return "photo-" + stamp + "." + extension;
  }

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl || "").split(",");
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function extensionForMime(mime) {
    if (!mime) return "png";
    if (mime.indexOf("jpeg") >= 0 || mime.indexOf("jpg") >= 0) return "jpg";
    if (mime.indexOf("webp") >= 0) return "webp";
    return "png";
  }

  function download_blob(blob, filename) {
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || defaultPhotoFilename("png");
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return true;
  }

  function download_image(params = {}) {
    const statusId = params.statusId;
    let dataUrl = params.dataUrl || "";
    const key = params.key || "camera";

    if (!dataUrl && params.imageId) {
      const img = byId(params.imageId);
      if (img && img.src) dataUrl = img.src;
    }
    if (!dataUrl && params.canvasId) {
      const canvas = byId(params.canvasId);
      if (canvas) dataUrl = canvas.toDataURL(params.imageType || "image/png");
    }
    if (!dataUrl && state.captures[key]) {
      dataUrl = state.captures[key];
    }

    if (!dataUrl) {
      if (statusId) setText(statusId, "No image to download.");
      return false;
    }

    const blob = dataUrlToBlob(dataUrl);
    if (!blob) {
      if (statusId) setText(statusId, "Could not prepare image download.");
      return false;
    }

    const filename = params.filename || defaultPhotoFilename(extensionForMime(blob.type));
    const ok = download_blob(blob, filename);
    if (statusId) setText(statusId, ok ? ("Saved " + filename) : "Download failed.");
    return ok;
  }

  function download_captured_image(params = {}) {
    const key = params.key || "camera";
    return download_image(Object.assign({}, params, {
      dataUrl: params.dataUrl || state.captures[key]
    }));
  }

  function get_camera_facing(params = {}) {
    const key = params.key || "camera";
    return state.cameraFacing[key] || params.facingMode || "environment";
  }

  async function start_camera(params = {}) {
    const videoEl = byId(params.videoId || "cameraVideo");
    const statusId = params.statusId || "cameraStatus";
    const key = params.key || "camera";
    const facingMode = params.facingMode || state.cameraFacing[key] || "environment";
    if (!videoEl) return null;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setText(statusId, "Live camera not available. Use file input fallback.");
      return null;
    }

    const existing = state.streams[key];
    if (existing) {
      existing.getTracks().forEach(function (track) { track.stop(); });
      state.streams[key] = null;
      videoEl.srcObject = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: false
      });
      state.streams[key] = stream;
      state.cameraFacing[key] = facingMode;
      videoEl.srcObject = stream;
      const label = facingMode === "user" ? "Front camera" : "Back camera";
      setText(statusId, label + " started.");
      return stream;
    } catch (error) {
      if (facingMode === "user") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
          });
          state.streams[key] = stream;
          state.cameraFacing[key] = "environment";
          videoEl.srcObject = stream;
          setText(statusId, "Front camera unavailable. Using back camera.");
          return stream;
        } catch (_) {}
      }
      const denied = error && (error.name === "NotAllowedError" || /permission/i.test(error.message || ""));
      if (denied) {
        setText(statusId, "Camera permission denied.");
        if (params.showDialog !== false) {
          show_permission_dialog({
            kind: "camera",
            message: "Camera access is blocked. Tap Open Settings, enable Camera for this app, then Try again.",
            onRetry: function () { start_camera(Object.assign({}, params, { showDialog: false })); }
          });
        }
      } else {
        setText(statusId, "Camera error: " + error.message);
      }
      const fallbackId = params.inputId || "cameraInput";
      const fallback = byId(fallbackId);
      if (denied && params.useFallback !== false && fallback) fallback.click();
      return null;
    }
  }

  async function start_front_camera(params = {}) {
    return start_camera(Object.assign({}, params, { facingMode: "user" }));
  }

  async function start_back_camera(params = {}) {
    return start_camera(Object.assign({}, params, { facingMode: "environment" }));
  }

  async function switch_camera(params = {}) {
    const key = params.key || "camera";
    const current = get_camera_facing({ key: key });
    const next = current === "user" ? "environment" : "user";
    return start_camera(Object.assign({}, params, { facingMode: next }));
  }

  function stop_camera(params = {}) {
    const key = params.key || "camera";
    const statusId = params.statusId || "cameraStatus";
    const stream = state.streams[key];
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    state.streams[key] = null;
    setText(statusId, "Camera stopped.");
  }

  function capture_image(params = {}) {
    const videoEl = byId(params.videoId || "cameraVideo");
    const canvasEl = byId(params.canvasId || "cameraCanvas");
    const imageEl = byId(params.imageId || "capturedImage");
    const statusId = params.statusId || "cameraStatus";
    const key = params.key || "camera";
    if (!videoEl || !canvasEl || !imageEl || !videoEl.videoWidth) {
      setText(statusId, "Start camera first.");
      return "";
    }

    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    const ctx = canvasEl.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    const dataUrl = canvasEl.toDataURL(params.imageType || "image/png");
    imageEl.src = dataUrl;
    state.captures[key] = dataUrl;
    setText(statusId, "Image captured.");
    if (params.download) {
      download_captured_image({
        key: key,
        dataUrl: dataUrl,
        filename: params.filename,
        statusId: statusId
      });
    }
    return dataUrl;
  }

  function load_image_from_input(params = {}) {
    const inputEl = byId(params.inputId || "cameraInput");
    const imageEl = byId(params.imageId || "capturedImage");
    const statusId = params.statusId || "cameraStatus";
    if (!inputEl || !inputEl.files || !inputEl.files[0] || !imageEl) {
      setText(statusId, "No image selected.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      imageEl.src = reader.result;
      const key = params.key || "camera";
      state.captures[key] = reader.result;
      setText(statusId, "Image loaded.");
      if (params.download) {
        download_captured_image({
          key: key,
          dataUrl: reader.result,
          filename: params.filename,
          statusId: statusId
        });
      }
    };
    reader.readAsDataURL(inputEl.files[0]);
  }

  async function start_recording(params = {}) {
    const statusId = params.statusId || "micStatus";
    const key = params.key || "mic";
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setText(statusId, "Microphone API not available.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      state.streams[key] = stream;
      state.recorders[key] = recorder;
      state.chunks[key] = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) state.chunks[key].push(event.data);
      };
      recorder.start();
      setText(statusId, "Recording...");
      return true;
    } catch (error) {
      const denied = error && (error.name === "NotAllowedError" || /permission/i.test(error.message || ""));
      setText(statusId, denied ? "Microphone permission denied." : ("Microphone error: " + error.message));
      if (denied && params.showDialog !== false) {
        show_permission_dialog({
          kind: "microphone",
          message: "Microphone access is blocked. Open Settings, enable Microphone, then Try again.",
          onRetry: function () { start_recording(Object.assign({}, params, { showDialog: false })); }
        });
      }
      return false;
    }
  }

  function stop_recording(params = {}) {
    const statusId = params.statusId || "micStatus";
    const audioId = params.audioId || "recordedAudio";
    const downloadId = params.downloadId || "downloadAudioLink";
    const key = params.key || "mic";
    const recorder = state.recorders[key];
    if (!recorder || recorder.state !== "recording") {
      setText(statusId, "Recorder is not running.");
      return;
    }
    recorder.onstop = function () {
      const audioBlob = new Blob(state.chunks[key], { type: "audio/webm" });
      const url = URL.createObjectURL(audioBlob);
      const audioEl = byId(audioId);
      const downloadEl = byId(downloadId);
      if (audioEl) audioEl.src = url;
      if (downloadEl) downloadEl.href = url;
      setText(statusId, "Recording ready.");
    };
    recorder.stop();
    const stream = state.streams[key];
    if (stream) stream.getTracks().forEach((track) => track.stop());
  }

  function get_location(params = {}) {
    const outputId = params.outputId || "gpsOutput";
    if (!navigator.geolocation) {
      setText(outputId, "Geolocation not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setText(
          outputId,
          "Latitude: " + pos.coords.latitude +
          "\nLongitude: " + pos.coords.longitude +
          "\nAccuracy: " + pos.coords.accuracy + "m"
        );
      },
      (err) => setText(outputId, "Location error: " + err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function watch_location(params = {}) {
    const outputId = params.outputId || "gpsOutput";
    const key = params.key || "gps";
    if (!navigator.geolocation) {
      setText(outputId, "Geolocation not supported.");
      return;
    }
    if (state.watchIds[key] != null) {
      setText(outputId, "Already watching location.");
      return;
    }
    state.watchIds[key] = navigator.geolocation.watchPosition(
      (pos) => {
        setText(
          outputId,
          "Latitude: " + pos.coords.latitude +
          "\nLongitude: " + pos.coords.longitude +
          "\nAccuracy: " + pos.coords.accuracy + "m"
        );
      },
      (err) => setText(outputId, "Location error: " + err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function stop_watch_location(params = {}) {
    const outputId = params.outputId || "gpsOutput";
    const key = params.key || "gps";
    if (state.watchIds[key] == null) {
      setText(outputId, "No active location watch.");
      return;
    }
    navigator.geolocation.clearWatch(state.watchIds[key]);
    state.watchIds[key] = null;
    setText(outputId, "Stopped watching location.");
  }

  function decode_qr_canvas(canvasEl, invert) {
    if (typeof jsQR !== "function" || !canvasEl) return "";
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return "";
    const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
    const qr = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: invert || "attemptBoth"
    });
    return qr ? qr.data : "";
  }

  async function scan_qr(params = {}) {
    const videoId = params.videoId || "qrVideo";
    const canvasId = params.canvasId || "qrCanvas";
    const resultId = params.resultId || "qrResult";
    const inputId = params.fileInputId || "qrFileInput";
    const inputEl = byId(inputId);
    const canvasEl = byId(canvasId);
    const videoEl = byId(videoId);

    if (inputEl && inputEl.files && inputEl.files[0] && canvasEl) {
      const img = new Image();
      return await new Promise((resolve) => {
        img.onload = function () {
          canvasEl.width = img.width;
          canvasEl.height = img.height;
          const ctx = canvasEl.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const text = decode_qr_canvas(canvasEl, params.invert);
          setText(resultId, text ? "QR Result: " + text : "No QR found.");
          resolve(text);
        };
        img.onerror = function () {
          setText(resultId, "Image load failed.");
          resolve("");
        };
        img.src = URL.createObjectURL(inputEl.files[0]);
      });
    }

    if (!videoEl || !canvasEl) {
      setText(resultId, "QR elements not found.");
      return "";
    }

    const started = await start_camera({
      videoId,
      statusId: resultId,
      key: params.key || "qr",
      facingMode: params.facingMode || "environment"
    });
    if (!started) return "";

    await new Promise((resolve) => setTimeout(resolve, params.captureDelayMs || 800));
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    const ctx = canvasEl.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    const text = decode_qr_canvas(canvasEl, params.invert);
    setText(resultId, text ? "QR Result: " + text : "No QR found.");
    if (params.autoStop !== false) {
      stop_camera({ key: params.key || "qr", statusId: resultId });
    }
    return text;
  }

  function open_call(number) {
    window.location.href = "tel:" + number;
  }
  function open_sms(number) {
    window.location.href = "sms:" + number;
  }
  function open_email(address) {
    window.location.href = "mailto:" + address;
  }
  function open_map(lat, lng) {
    window.open("https://maps.google.com?q=" + lat + "," + lng, "_blank");
  }
  function open_whatsapp(number, text) {
    window.open("https://wa.me/" + number + "?text=" + encodeURIComponent(text || ""), "_blank");
  }

  function open_app_with_fallback(appUrl, webUrl, delayMs) {
    window.location = appUrl;
    setTimeout(function () {
      window.location = webUrl;
    }, delayMs || 2000);
  }

  function get_manifest_template() {
    return JSON.stringify({
      name: "My Student App",
      short_name: "StudentApp",
      start_url: "./",
      display: "standalone",
      theme_color: "#2563eb",
      background_color: "#ffffff",
      icons: [
        { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }
      ]
    }, null, 2);
  }

  function get_service_worker_template() {
    return "const CACHE_NAME='student-app-cache-v1';\n" +
      "const ASSETS=['./','./index.html','./styles.css','./app.js','./mobile-features-lib.js'];\n" +
      "self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS))));\n" +
      "self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));";
  }

  async function register_service_worker(file) {
    if (!("serviceWorker" in navigator)) return false;
    try {
      await navigator.serviceWorker.register(file || "./service-worker.js");
      return true;
    } catch (error) {
      return false;
    }
  }

  global.MobileFeatures = {
    start_camera,
    stop_camera,
    start_front_camera,
    start_back_camera,
    switch_camera,
    get_camera_facing,
    capture_image,
    download_image,
    download_captured_image,
    load_image_from_input,
    start_recording,
    stop_recording,
    get_location,
    watch_location,
    stop_watch_location,
    scan_qr,
    open_call,
    open_sms,
    open_email,
    open_map,
    open_whatsapp,
    open_app_with_fallback,
    get_manifest_template,
    get_service_worker_template,
    register_service_worker,
    is_android_app: isAndroidApp,
    open_app_settings,
    request_android_permission,
    has_android_permission,
    show_permission_dialog
  };
})(window);
