/**
 * Educational "Sync to Mobile" API — Express + Octokit + Capacitor CI scaffold.
 */
import 'dotenv/config';
import express from 'express';
import { syncToGithub, checkBuildStatus, repoNameForStudent, getOwner } from './githubSync.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'mobile-sync-backend' });
});

/**
 * POST /sync-to-github
 * Body: { studentId, html, css, js }
 */
app.post('/sync-to-github', async (req, res) => {
  try {
    const { studentId, html, css, js } = req.body || {};
    if (!studentId || typeof html !== 'string' || typeof css !== 'string' || typeof js !== 'string') {
      return res.status(400).json({
        error: 'Expected JSON body: { studentId: string, html: string, css: string, js: string }'
      });
    }
    const meta = await syncToGithub(studentId, html, css, js);
    res.json({
      ok: true,
      ...meta,
      repoUrl: `https://github.com/${meta.owner}/${meta.repo}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

/**
 * GET /check-build-status/:studentId
 * Returns latest workflow run + APK artifact API URL when successful.
 */
app.get('/check-build-status/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const status = await checkBuildStatus(studentId);
    const ready = status.status === 'completed' && status.conclusion === 'success' && !!status.artifactUrl;
    res.json({
      ok: true,
      studentId,
      repo: `${getOwner()}/${repoNameForStudent(studentId)}`,
      ready,
      ...status
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

const port = Number(process.env.PORT || 3847);
app.listen(port, () => {
  console.log(`mobile-sync-backend listening on http://localhost:${port}`);
});
