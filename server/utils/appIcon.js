const path = require('path');
const fse = require('fs-extra');

const ALLOWED_ICON_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};

function extensionForMime(mime) {
  return EXT_BY_MIME[mime] || null;
}

function validateAppIcon(file) {
  if (!file || !file.buffer || !file.buffer.length) {
    return { ok: false, error: 'appIcon is required' };
  }
  const mime = String(file.mimetype || '').toLowerCase();
  if (!ALLOWED_ICON_MIME.has(mime)) {
    return { ok: false, error: 'App icon must be PNG, JPEG, or WebP' };
  }
  const ext = extensionForMime(mime);
  if (!ext) {
    return { ok: false, error: 'Unsupported app icon type' };
  }
  return { ok: true, mime, ext };
}

const ADAPTIVE_ICON_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/white" />
    <foreground android:drawable="@drawable/ic_launcher_custom" />
    <monochrome android:drawable="@drawable/ic_launcher_custom" />
</adaptive-icon>
`;

/**
 * Apply uploaded launcher icon into the cloned apk-builder project.
 */
async function applyAppIcon(cloneDir, iconBuffer, mime) {
  const ext = extensionForMime(mime);
  if (!ext) throw new Error('Unsupported app icon type');

  const resDir = path.join(cloneDir, 'app/src/main/res');
  const drawableDir = path.join(resDir, 'drawable-nodpi');
  await fse.ensureDir(drawableDir);

  const customDrawablePath = path.join(drawableDir, `ic_launcher_custom.${ext}`);
  await fse.writeFile(customDrawablePath, iconBuffer);

  const adaptiveDir = path.join(resDir, 'mipmap-anydpi-v26');
  await fse.ensureDir(adaptiveDir);
  await fse.writeFile(path.join(adaptiveDir, 'ic_launcher.xml'), ADAPTIVE_ICON_XML, 'utf8');
  await fse.writeFile(path.join(adaptiveDir, 'ic_launcher_round.xml'), ADAPTIVE_ICON_XML, 'utf8');

  const entries = await fse.readdir(resDir);
  const densityDirs = entries.filter((name) => /^mipmap-(?!anydpi)/.test(name));

  for (const dirName of densityDirs) {
    const mipmapDir = path.join(resDir, dirName);
    const files = await fse.readdir(mipmapDir);
    for (const file of files) {
      if (/^ic_launcher(_round)?\.(webp|png|jpg|jpeg)$/i.test(file)) {
        await fse.remove(path.join(mipmapDir, file));
      }
    }
    await fse.writeFile(path.join(mipmapDir, `ic_launcher.${ext}`), iconBuffer);
    await fse.writeFile(path.join(mipmapDir, `ic_launcher_round.${ext}`), iconBuffer);
  }
}

module.exports = {
  ALLOWED_ICON_MIME,
  validateAppIcon,
  applyAppIcon
};
