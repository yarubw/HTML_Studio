/**
 * Client-side APK builder for Yarub HTML Studio.
 * Repacks a WebView shell APK with project assets, then signs locally via apksig WASM.
 */
(function (global) {
  'use strict';

  var BASE_APK_URL = 'vendor/webview-shell-base.apk';
  var KEYSTORE_URL = 'vendor/yarub-debug.p12';
  var KEYSTORE_PASS = 'yarubhtml';
  var KEYSTORE_ALIAS = 'yarubhtml';
  var APP_NAME_SLOT = 'HTML Studio App';
  var WWW_PREFIX = 'assets/www/';
  var ICON_PATHS = [
    { zipPath: 'res/drawable-nodpi-v4/ic_launcher_custom.png', size: 512 },
    { zipPath: 'res/drawable-nodpi-v4/ic_launcher.png', size: 512 },
    { zipPath: 'res/drawable-nodpi-v4/ic_launcher_round.png', size: 512 },
    { zipPath: 'res/mipmap-mdpi-v4/ic_launcher.png', size: 48 },
    { zipPath: 'res/mipmap-mdpi-v4/ic_launcher_custom.png', size: 48 },
    { zipPath: 'res/mipmap-mdpi-v4/ic_launcher_round.png', size: 48 },
    { zipPath: 'res/mipmap-hdpi-v4/ic_launcher.png', size: 72 },
    { zipPath: 'res/mipmap-hdpi-v4/ic_launcher_custom.png', size: 72 },
    { zipPath: 'res/mipmap-hdpi-v4/ic_launcher_round.png', size: 72 },
    { zipPath: 'res/mipmap-xhdpi-v4/ic_launcher.png', size: 96 },
    { zipPath: 'res/mipmap-xhdpi-v4/ic_launcher_custom.png', size: 96 },
    { zipPath: 'res/mipmap-xhdpi-v4/ic_launcher_round.png', size: 96 },
    { zipPath: 'res/mipmap-xxhdpi-v4/ic_launcher.png', size: 144 },
    { zipPath: 'res/mipmap-xxhdpi-v4/ic_launcher_custom.png', size: 144 },
    { zipPath: 'res/mipmap-xxhdpi-v4/ic_launcher_round.png', size: 144 },
    { zipPath: 'res/mipmap-xxxhdpi-v4/ic_launcher.png', size: 192 },
    { zipPath: 'res/mipmap-xxxhdpi-v4/ic_launcher_custom.png', size: 192 },
    { zipPath: 'res/mipmap-xxxhdpi-v4/ic_launcher_round.png', size: 192 }
  ];

  var wasmPromise = null;
  var keystoreBytes = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-apk-src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === '1') resolve();
        else existing.addEventListener('load', function () { resolve(); }, { once: true });
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.dataset.apkSrc = src;
      s.onload = function () {
        s.dataset.loaded = '1';
        resolve();
      };
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function ensureApkSigWasm() {
    if (typeof global.apksigSignKeystore === 'function') return Promise.resolve();
    if (wasmPromise) return wasmPromise;
    wasmPromise = loadScript('vendor/wasm_exec.js').then(function () {
      if (typeof Go === 'undefined') throw new Error('Go WASM runtime missing');
      var go = new Go();
      return fetch('vendor/apksig.wasm', { cache: 'force-cache' })
        .then(function (res) {
          if (!res.ok) throw new Error('Could not load apksig.wasm');
          return res.arrayBuffer();
        })
        .then(function (buf) {
          return WebAssembly.instantiate(buf, go.importObject).then(function (result) {
            go.run(result.instance);
            if (typeof global.apksigSignKeystore !== 'function') {
              throw new Error('apksig WASM did not initialize');
            }
          });
        });
    });
    return wasmPromise;
  }

  function loadKeystore() {
    if (keystoreBytes) return Promise.resolve(keystoreBytes);
    return fetch(KEYSTORE_URL, { cache: 'force-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('Could not load signing keystore');
        return res.arrayBuffer();
      })
      .then(function (buf) {
        keystoreBytes = new Uint8Array(buf);
        return keystoreBytes;
      });
  }

  function loadBaseApkZip() {
    return fetch(BASE_APK_URL, { cache: 'force-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('Could not load APK template');
        return res.arrayBuffer();
      })
      .then(function (buf) {
        return JSZip.loadAsync(buf);
      });
  }

  function patchAppNameInArsc(arscBytes, appName) {
    var slot = APP_NAME_SLOT;
    var maxLen = slot.length;
    var trimmed = String(appName || '').trim().slice(0, maxLen);
    if (!trimmed) trimmed = 'My App';
    while (trimmed.length < maxLen) trimmed += ' ';
    var next = new Uint8Array(arscBytes);
    var needle = new TextEncoder().encode(slot);
    var idx = -1;
    for (var i = 0; i <= next.length - needle.length; i++) {
      var ok = true;
      for (var j = 0; j < needle.length; j++) {
        if (next[i + j] !== needle[j]) { ok = false; break; }
      }
      if (ok) { idx = i; break; }
    }
    if (idx < 0) return next;
    var replacement = new TextEncoder().encode(trimmed);
    for (var k = 0; k < replacement.length; k++) next[idx + k] = replacement[k];
    return next;
  }

  function resizeIconFile(file, size) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            if (!blob) {
              reject(new Error('Icon conversion failed'));
              return;
            }
            blob.arrayBuffer().then(resolve).catch(reject);
          }, 'image/png');
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read icon image'));
      };
      img.src = url;
    });
  }

  function mustStoreUncompressed(path) {
    if (path === 'AndroidManifest.xml' || path === 'resources.arsc') return true;
    if (/^classes\d*\.dex$/i.test(path)) return true;
    if (/\.so$/i.test(path)) return true;
    if (/^res\//i.test(path)) return true;
    return false;
  }

  function applyApkCompressionRules(zip) {
    Object.keys(zip.files).forEach(function (name) {
      var entry = zip.files[name];
      if (!entry || entry.dir) return;
      entry.options.compression = mustStoreUncompressed(name) ? 'STORE' : 'DEFLATE';
    });
  }

  function stripSignatureEntries(zip) {
    Object.keys(zip.files).forEach(function (name) {
      if (/^META-INF\//i.test(name)) delete zip.files[name];
    });
  }

  function zipToUint8Array(zip) {
    applyApkCompressionRules(zip);
    return zip.generateAsync({ type: 'uint8array' });
  }

  /**
   * @param {Object} opts
   * @param {string} opts.appName
   * @param {File} opts.iconFile
   * @param {Array<{path:string,data:string|ArrayBuffer|Uint8Array}>} opts.projectFiles
   * @param {function(string):void} [opts.onStatus]
   * @returns {Promise<Blob>}
   */
  async function buildClientApk(opts) {
    var appName = opts && opts.appName;
    var iconFile = opts && opts.iconFile;
    var projectFiles = (opts && opts.projectFiles) || [];
    var onStatus = (opts && opts.onStatus) || function () {};

    if (typeof JSZip === 'undefined') throw new Error('JSZip is required');
    if (!iconFile) throw new Error('App icon is required');
    if (!projectFiles.length) throw new Error('Project files are required');

    onStatus('Loading signer…');
    await ensureApkSigWasm();
    onStatus('Loading template…');
    var zip = await loadBaseApkZip();

    onStatus('Injecting project files…');
    Object.keys(zip.files).forEach(function (name) {
      if (name.indexOf(WWW_PREFIX) === 0) delete zip.files[name];
    });
    var hasRootIndex = false;
    for (var i = 0; i < projectFiles.length; i++) {
      var entry = projectFiles[i];
      var rel = String(entry.path || '').replace(/^\/+/, '');
      if (!rel) continue;
      var target = WWW_PREFIX + rel;
      var data = entry.data;
      if (typeof data === 'string') zip.file(target, data);
      else zip.file(target, data);
      if (rel.toLowerCase() === 'index.html') hasRootIndex = true;
    }
    if (!hasRootIndex) throw new Error('Project needs index.html at the root');

    onStatus('Applying app icon…');
    for (var p = 0; p < ICON_PATHS.length; p++) {
      var iconSpec = ICON_PATHS[p];
      var pngBuf = await resizeIconFile(iconFile, iconSpec.size);
      zip.file(iconSpec.zipPath, pngBuf);
    }

    onStatus('Updating app name…');
    var arscEntry = zip.file('resources.arsc');
    if (arscEntry) {
      var arscBytes = await arscEntry.async('uint8array');
      zip.file('resources.arsc', patchAppNameInArsc(arscBytes, appName));
    }

    stripSignatureEntries(zip);

    onStatus('Packaging APK…');
    var unsignedApk = await zipToUint8Array(zip);

    onStatus('Signing APK in browser…');
    var ks = await loadKeystore();
    var signed = global.apksigSignKeystore(unsignedApk, ks, {
      storePass: KEYSTORE_PASS,
      keyPass: KEYSTORE_PASS,
      alias: KEYSTORE_ALIAS,
      v1: false,
      v3: true,
      v31: false,
      v4: false,
      align: true,
      v3MinSdk: 24,
      v3MaxSdk: 35,
      v31MinSdk: 33
    });
    if (!signed || signed.error) {
      throw new Error((signed && signed.error) || 'APK signing failed');
    }

    var signedBytes = signed.signedApk instanceof Uint8Array
      ? signed.signedApk
      : new Uint8Array(signed.signedApk);

    if (typeof global.apksigVerify === 'function') {
      var verify = global.apksigVerify(signedBytes, { minSdk: 24, maxSdk: 35 });
      if (!verify || !verify.verified) {
        var detail = (verify && verify.errors && verify.errors.join('; ')) || 'unknown';
        throw new Error('Signed APK failed verification: ' + detail);
      }
    }

    return new Blob([signedBytes], { type: 'application/vnd.android.package-archive' });
  }

  var builderLoadPromise = null;
  function ensureApkClientBuilderLoaded() {
    if (typeof global.YarubApkClient !== 'undefined') return Promise.resolve();
    return Promise.resolve();
  }

  global.YarubApkClient = {
    buildClientApk: buildClientApk,
    ensureApkSigWasm: ensureApkSigWasm,
    ensureApkClientBuilderLoaded: ensureApkClientBuilderLoaded
  };
})(window);
