const path = require('path');
const fse = require('fs-extra');
const simpleGit = require('simple-git');
const axios = require('axios');
const AdmZip = require('adm-zip');
const { extractZipSafely } = require('../utils/zipValidation');
const { applyAppIcon } = require('../utils/appIcon');
const { updateJob, STATUS } = require('./jobs');

const POLL_MS = 8000;
const MAX_POLL_ATTEMPTS = 90; // ~12 minutes

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function updateAppName(stringsPath, appName) {
  let xml = await fse.readFile(stringsPath, 'utf8');
  if (!/<string name="app_name">/.test(xml)) {
    throw new Error('app_name string not found in strings.xml');
  }
  xml = xml.replace(
    /<string name="app_name">[^<]*<\/string>/,
    `<string name="app_name">${escapeXml(appName)}</string>`
  );
  await fse.writeFile(stringsPath, xml, 'utf8');
}

async function triggerWorkflow({ owner, repo, workflow, branch, token }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;
  await axios.post(
    url,
    { ref: branch },
    { headers: githubHeaders(token) }
  );
}

async function waitForWorkflowRun({ owner, repo, branch, token }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs`;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    await new Promise((r) => setTimeout(r, POLL_MS));

    const { data } = await axios.get(url, {
      headers: githubHeaders(token),
      params: {
        branch,
        per_page: 5
      }
    });

    const run = data.workflow_runs && data.workflow_runs[0];
    if (!run) continue;

    if (run.status === 'completed') {
      return run;
    }
  }

  throw new Error('Timed out waiting for GitHub Actions workflow');
}

async function downloadArtifactApk({ owner, repo, runId, token, destApkPath }) {
  const artifactsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`;
  const { data } = await axios.get(artifactsUrl, { headers: githubHeaders(token) });
  const artifacts = data.artifacts || [];

  if (!artifacts.length) {
    throw new Error('No workflow artifacts found');
  }

  // Prefer artifact that looks like an APK bundle; otherwise use the first artifact.
  const artifact =
    artifacts.find((a) => /apk/i.test(a.name)) ||
    artifacts[0];

  const zipRes = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifact.id}/zip`,
    {
      headers: githubHeaders(token),
      responseType: 'arraybuffer'
    }
  );

  const artifactZip = new AdmZip(Buffer.from(zipRes.data));
  const apkEntry = artifactZip
    .getEntries()
    .find((e) => !e.isDirectory && e.entryName.toLowerCase().endsWith('.apk'));

  if (!apkEntry) {
    throw new Error('No .apk file found inside workflow artifact');
  }

  await fse.ensureDir(path.dirname(destApkPath));
  await fse.writeFile(destApkPath, apkEntry.getData());
}

async function deleteRemoteBranch({ owner, repo, branch, token }) {
  try {
    await axios.delete(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
      { headers: githubHeaders(token) }
    );
  } catch (err) {
    // Non-fatal cleanup
    console.warn(`Could not delete remote branch ${branch}:`, err.message);
  }
}

/**
 * Clone apk-builder, inject www assets, push branch, run CI, save APK.
 */
async function processBuildJob(job, zipBuffer, iconBuffer, iconMime, config) {
  const {
    githubToken,
    githubOwner,
    githubRepo,
    githubWorkflow,
    githubRepoSsh,
    tempRoot,
    publicApksDir
  } = config;

  const jobId = job.id;
  const branch = `build-${jobId}`;
  const tempDir = path.join(tempRoot, jobId);
  const cloneDir = path.join(tempDir, 'repo');
  const wwwDir = path.join(cloneDir, 'app/src/main/assets/www');
  const stringsPath = path.join(cloneDir, 'app/src/main/res/values/strings.xml');
  const destApkPath = path.join(publicApksDir, `${jobId}.apk`);

  updateJob(jobId, { status: STATUS.BUILDING, error: null });

  await fse.ensureDir(tempDir);

  try {
    const git = simpleGit();
    await git.clone(githubRepoSsh, cloneDir, ['--depth', '1']);

    const repoGit = simpleGit(cloneDir);
    await repoGit.addConfig('user.email', 'apk-builder@local', false, 'local');
    await repoGit.addConfig('user.name', 'APK Builder', false, 'local');
    await repoGit.checkoutLocalBranch(branch);

    await fse.remove(wwwDir);
    await fse.ensureDir(wwwDir);

    const AdmZipLib = require('adm-zip');
    const zip = new AdmZipLib(zipBuffer);
    extractZipSafely(zip, wwwDir);

    await updateAppName(stringsPath, job.appName);
    await applyAppIcon(cloneDir, iconBuffer, iconMime);

    await repoGit.add(['app/src/main/assets/www', 'app/src/main/res']);
    await repoGit.commit(`Build student APK: ${job.appName} (${jobId})`);
    await repoGit.push('origin', branch, ['--set-upstream']);

    await triggerWorkflow({
      owner: githubOwner,
      repo: githubRepo,
      workflow: githubWorkflow,
      branch,
      token: githubToken
    });

    const run = await waitForWorkflowRun({
      owner: githubOwner,
      repo: githubRepo,
      branch,
      token: githubToken
    });

    if (run.conclusion !== 'success') {
      throw new Error(`GitHub Actions failed: ${run.conclusion || 'unknown'}`);
    }

    await downloadArtifactApk({
      owner: githubOwner,
      repo: githubRepo,
      runId: run.id,
      token: githubToken,
      destApkPath
    });

    updateJob(jobId, {
      status: STATUS.SUCCESS,
      apkUrl: `/apks/${jobId}.apk`
    });

    await deleteRemoteBranch({
      owner: githubOwner,
      repo: githubRepo,
      branch,
      token: githubToken
    });
  } catch (err) {
    console.error(`Build job ${jobId} failed:`, err);
    updateJob(jobId, {
      status: STATUS.FAILED,
      error: err.message || String(err)
    });

    try {
      await deleteRemoteBranch({
        owner: githubOwner,
        repo: githubRepo,
        branch,
        token: githubToken
      });
    } catch (_) {}
  } finally {
    await fse.remove(tempDir).catch(() => {});
  }
}

module.exports = { processBuildJob };
