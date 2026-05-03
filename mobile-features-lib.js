/* MobileFeatures Library
 * Student-facing API with simple method calls.
 */
(function (global) {
  const state = {
    streams: {},
    recorders: {},
    chunks: {},
    watchIds: {}
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    const el = byId(id);
    if (el) el.textContent = text;
  }

  async function start_camera(params = {}) {
    const videoEl = byId(params.videoId || "cameraVideo");
    const statusId = params.statusId || "cameraStatus";
    const key = params.key || "camera";
    const facingMode = params.facingMode || "environment";
    if (!videoEl) return null;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setText(statusId, "Live camera not available. Use file input fallback.");
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false
      });
      state.streams[key] = stream;
      videoEl.srcObject = stream;
      setText(statusId, "Camera started.");
      return stream;
    } catch (error) {
      setText(statusId, "Camera error: " + error.message);
      return null;
    }
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
    setText(statusId, "Image captured.");
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
      setText(statusId, "Image loaded.");
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
      setText(statusId, "Microphone error: " + error.message);
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
    capture_image,
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
    register_service_worker
  };
})(window);
