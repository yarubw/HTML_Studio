const path = require('path');
const AdmZip = require('adm-zip');

/** File extensions allowed inside student project ZIPs. */
const ALLOWED_EXT = new Set([
  'html', 'css', 'js', 'json', 'txt',
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico',
  'mp3', 'wav', 'mp4'
]);

function normalizeZipPath(entryName) {
  const normalized = path.posix.normalize(String(entryName || '').replace(/\\/g, '/'));
  if (
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized === '..' ||
    path.posix.isAbsolute(normalized)
  ) {
    return null;
  }
  return normalized.replace(/^\.\//, '');
}

function isAllowedFile(relativePath) {
  const base = path.posix.basename(relativePath);
  if (!base || base.startsWith('.')) return false;
  const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
  return ALLOWED_EXT.has(ext);
}

/**
 * Validate uploaded ZIP buffer before queuing a build.
 * @returns {{ ok: true, zip: AdmZip } | { ok: false, error: string }}
 */
function validateProjectZip(buffer) {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return { ok: false, error: 'Invalid ZIP file' };
  }

  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  if (!entries.length) {
    return { ok: false, error: 'ZIP is empty' };
  }

  let hasRootIndex = false;

  for (const entry of entries) {
    const relative = normalizeZipPath(entry.entryName);
    if (!relative) {
      return { ok: false, error: 'ZIP contains unsafe paths' };
    }
    if (!isAllowedFile(relative)) {
      return { ok: false, error: `Disallowed file type: ${relative}` };
    }
    if (relative === 'index.html') {
      hasRootIndex = true;
    }
  }

  if (!hasRootIndex) {
    return { ok: false, error: 'ZIP must contain index.html at the root' };
  }

  return { ok: true, zip };
}

/**
 * Extract ZIP entries into destDir with zip-slip protection.
 */
function extractZipSafely(zip, destDir) {
  const fse = require('fs-extra');
  fse.ensureDirSync(destDir);

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;

    const relative = normalizeZipPath(entry.entryName);
    if (!relative) {
      throw new Error('ZIP contains unsafe paths');
    }
    if (!isAllowedFile(relative)) {
      throw new Error(`Disallowed file type: ${relative}`);
    }

    const outPath = path.join(destDir, relative);
    const outDir = path.dirname(outPath);
    fse.ensureDirSync(outDir);
    fse.writeFileSync(outPath, entry.getData());
  }
}

module.exports = {
  ALLOWED_EXT,
  validateProjectZip,
  extractZipSafely,
  normalizeZipPath,
  isAllowedFile
};
