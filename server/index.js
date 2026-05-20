require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fse = require('fs-extra');

const { validateProjectZip } = require('./utils/zipValidation');
const { validateAppIcon } = require('./utils/appIcon');
const { createJob, getJob } = require('./services/jobs');
const { enqueueBuild } = require('./services/queue');

const PORT = Number(process.env.PORT || 3000);
const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const MAX_ICON_BYTES = 2 * 1024 * 1024;

const app = express();
app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, 'public');
const apksDir = path.join(publicDir, 'apks');
const tempRoot = path.join(__dirname, 'temp');

fse.ensureDirSync(apksDir);
fse.ensureDirSync(tempRoot);

// Only APK outputs are public — not temp build folders.
app.use('/apks', express.static(apksDir));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ZIP_BYTES }
});

const uploadBuild = upload.fields([
  { name: 'zipFile', maxCount: 1 },
  { name: 'appIcon', maxCount: 1 }
]);

function getConfig() {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error('GITHUB_TOKEN is not set in server/.env');
  }
  return {
    githubToken,
    githubOwner: process.env.GITHUB_OWNER || 'yarubw',
    githubRepo: process.env.GITHUB_REPO || 'apk-builder',
    githubWorkflow: process.env.GITHUB_WORKFLOW || 'build-apk.yml',
    githubRepoSsh: process.env.GITHUB_REPO_SSH || 'git@github.com:yarubw/apk-builder.git',
    tempRoot,
    publicApksDir: apksDir
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'apk-builder-server' });
});

/**
 * POST /api/build
 * multipart: appName, zipFile, appIcon (PNG/JPEG/WebP, max 2MB)
 */
app.post('/api/build', uploadBuild, (req, res) => {
  try {
    const appName = String(req.body.appName || '').trim();
    if (!appName) {
      return res.status(400).json({ error: 'appName is required' });
    }
    if (appName.length > 80) {
      return res.status(400).json({ error: 'appName is too long (max 80 characters)' });
    }

    const zipFile = req.files && req.files.zipFile && req.files.zipFile[0];
    if (!zipFile || !zipFile.buffer) {
      return res.status(400).json({ error: 'zipFile is required' });
    }
    if (zipFile.size > MAX_ZIP_BYTES) {
      return res.status(400).json({ error: 'ZIP file exceeds 20MB limit' });
    }

    const iconFile = req.files && req.files.appIcon && req.files.appIcon[0];
    const iconValidation = validateAppIcon(iconFile);
    if (!iconValidation.ok) {
      return res.status(400).json({ error: iconValidation.error });
    }
    if (iconFile.size > MAX_ICON_BYTES) {
      return res.status(400).json({ error: 'App icon exceeds 2MB limit' });
    }

    const validation = validateProjectZip(zipFile.buffer);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    const config = getConfig();
    const job = createJob(appName);

    enqueueBuild(job, zipFile.buffer, iconFile.buffer, iconValidation.mime, config);

    res.json({ jobId: job.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

/**
 * GET /api/job/:jobId
 */
app.get('/api/job/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    id: job.id,
    status: job.status,
    apkUrl: job.apkUrl,
    error: job.error
  });
});

app.use((err, _req, res, _next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'ZIP file exceeds 20MB limit' });
  }
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`APK builder server listening on http://localhost:${PORT}`);
});
