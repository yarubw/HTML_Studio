/**
 * Client-side PWA / web app exporter for Yarub HTML Studio.
 * Packages project files with manifest.json, icons, and service worker.
 */
(function (global) {
  'use strict';

  var DEFAULT_ICON_URL = 'default.jpg';
  var DEFAULT_APP_NAME = 'test';
  var THEME_COLOR = '#2563eb';
  var BG_COLOR = '#ffffff';

  function escapeAttr(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function makeShortName(name, maxLen) {
    var s = String(name || '').trim().replace(/[^a-zA-Z0-9]+/g, '');
    if (!s) s = 'App';
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen);
  }

  function loadDefaultIconFile() {
    return fetch(DEFAULT_ICON_URL, { cache: 'force-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('Could not load default icon');
        return res.blob();
      })
      .then(function (blob) {
        var type = blob.type || 'image/jpeg';
        return new File([blob], 'default.jpg', { type: type });
      });
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

  function buildManifest(opts) {
    return JSON.stringify({
      name: opts.name,
      short_name: opts.shortName,
      start_url: './',
      scope: './',
      display: 'standalone',
      theme_color: opts.themeColor || THEME_COLOR,
      background_color: opts.backgroundColor || BG_COLOR,
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    }, null, 2);
  }

  function buildServiceWorker(assetPaths) {
    var paths = ['./', './index.html', './manifest.json'];
    assetPaths.forEach(function (p) {
      var rel = './' + String(p || '').replace(/^\/+/, '');
      if (paths.indexOf(rel) < 0) paths.push(rel);
    });
    paths.push('./icons/icon-192.png', './icons/icon-512.png');
    paths.push('./service-worker.js');

    var quoted = paths.map(function (p) { return JSON.stringify(p); }).join(',\n  ');
    return "const CACHE_NAME='web-app-cache-v1';\n" +
      'const ASSETS=[\n  ' + quoted + '\n];\n' +
      "self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE_NAME).then(function(c){return c.addAll(ASSETS)}))});\n" +
      "self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE_NAME}).map(function(k){return caches.delete(k)}))}))});\n" +
      "self.addEventListener('fetch',function(e){e.respondWith(caches.match(e.request).then(function(r){return r||fetch(e.request)}))});\n";
  }

  function injectPwaIntoHtml(html, opts) {
    var name = opts.name || DEFAULT_APP_NAME;
    var theme = opts.themeColor || THEME_COLOR;
    var next = String(html || '');
    var headInject = '';

    if (!/rel=["']manifest["']/i.test(next)) {
      headInject += '<link rel="manifest" href="manifest.json">\n';
    }
    if (!/name=["']theme-color["']/i.test(next)) {
      headInject += '<meta name="theme-color" content="' + theme + '">\n';
    }
    if (!/name=["']apple-mobile-web-app-capable["']/i.test(next)) {
      headInject += '<meta name="mobile-web-app-capable" content="yes">\n';
      headInject += '<meta name="apple-mobile-web-app-capable" content="yes">\n';
    }
    if (!/name=["']apple-mobile-web-app-title["']/i.test(next)) {
      headInject += '<meta name="apple-mobile-web-app-title" content="' + escapeAttr(name) + '">\n';
    }
    if (!/rel=["']apple-touch-icon["']/i.test(next)) {
      headInject += '<link rel="apple-touch-icon" href="icons/icon-192.png">\n';
    }

    if (headInject) {
      if (/<head[^>]*>/i.test(next)) {
        next = next.replace(/<head([^>]*)>/i, '<head$1>\n' + headInject);
      } else if (/<html[^>]*>/i.test(next)) {
        next = next.replace(/<html([^>]*)>/i, '<html$1>\n<head>\n' + headInject + '</head>');
      } else {
        next = headInject + next;
      }
    }

    if (!/service-worker\.js/i.test(next)) {
      var swScript = '<script>\n' +
        "if('serviceWorker'in navigator){\n" +
        "window.addEventListener('load',function(){\n" +
        "navigator.serviceWorker.register('./service-worker.js').catch(function(){});\n" +
        '});\n' +
        '}\n' +
        '<\/script>';
      if (/<\/body>/i.test(next)) {
        next = next.replace(/<\/body>/i, swScript + '\n</body>');
      } else {
        next += '\n' + swScript;
      }
    }

    return next;
  }

  /**
   * @param {Object} opts
   * @param {string} opts.appName
   * @param {File} [opts.iconFile]
   * @param {Array<{path:string,data:string|ArrayBuffer|Uint8Array}>} opts.projectFiles
   * @param {function(string):void} [opts.onStatus]
   * @returns {Promise<Blob>}
   */
  async function buildWebAppZip(opts) {
    var appName = (opts && opts.appName) || DEFAULT_APP_NAME;
    var iconFile = opts && opts.iconFile;
    var projectFiles = (opts && opts.projectFiles) || [];
    var onStatus = (opts && opts.onStatus) || function () {};

    if (typeof JSZip === 'undefined') throw new Error('JSZip is required');
    if (!String(appName || '').trim()) throw new Error('App name is required');
    if (!iconFile) iconFile = await loadDefaultIconFile();
    if (!projectFiles.length) throw new Error('Project files are required');

    onStatus('Creating icons…');
    var icon192 = await resizeIconFile(iconFile, 192);
    var icon512 = await resizeIconFile(iconFile, 512);

    var shortName = makeShortName(appName, 12);
    var manifest = buildManifest({ name: appName.trim(), shortName: shortName });

    var assetPaths = projectFiles.map(function (f) { return f.path; }).filter(function (p) {
      var base = String(p || '').split('/').pop().toLowerCase();
      return base !== 'manifest.json' && base !== 'service-worker.js';
    });
    var serviceWorker = buildServiceWorker(assetPaths);

    onStatus('Packaging web app…');
    var zip = new JSZip();
    var hasIndex = false;

    for (var i = 0; i < projectFiles.length; i++) {
      var entry = projectFiles[i];
      var rel = entry.path;
      var data = entry.data;
      if (rel.toLowerCase() === 'index.html') {
        if (typeof data !== 'string') throw new Error('index.html must be text');
        data = injectPwaIntoHtml(data, { name: appName.trim() });
        hasIndex = true;
      }
      zip.file(rel, data);
    }

    if (!hasIndex) throw new Error('Project needs index.html at the root');

    zip.file('manifest.json', manifest);
    zip.file('service-worker.js', serviceWorker);
    zip.file('icons/icon-192.png', icon192);
    zip.file('icons/icon-512.png', icon512);

    onStatus('Creating download…');
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  global.YarubWebAppExport = {
    buildWebAppZip: buildWebAppZip,
    loadDefaultIconFile: loadDefaultIconFile,
    DEFAULT_APP_NAME: DEFAULT_APP_NAME
  };
})(window);
