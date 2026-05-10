/**
 * GitHub sync: scaffold Capacitor repo per student, push www/* updates via REST API.
 */
import { Octokit } from '@octokit/rest';
import { buildScaffoldFiles, DEFAULT_APP_ID } from './scaffold.js';

function getEnv(name, required = true) {
  const v = process.env[name];
  if (required && (!v || !String(v).trim())) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v ? String(v).trim() : '';
}

export function createOctokit() {
  return new Octokit({ auth: getEnv('GITHUB_TOKEN') });
}

export function repoNameForStudent(studentId) {
  const prefix = getEnv('GITHUB_REPO_PREFIX', false) || 'webstudio-student-';
  const safe = String(studentId).replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${prefix}${safe}`.toLowerCase();
}

export function getOwner() {
  return getEnv('GITHUB_OWNER');
}

export function defaultBranch() {
  return getEnv('DEFAULT_BRANCH', false) || 'main';
}

export function workflowFile() {
  return getEnv('WORKFLOW_FILE', false) || 'build.yml';
}

function appIdForStudent(studentId) {
  const safe = String(studentId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 28) || 'student';
  return `com.edustudio.${safe}`;
}

async function getFileSha(octokit, owner, repo, path) {
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    if (Array.isArray(data) || !data.sha) return null;
    return data.sha;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function ensureRepository(octokit, owner, name) {
  try {
    await octokit.repos.get({ owner, repo: name });
    return false;
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  const useOrg = /^1|true$/i.test(getEnv('GITHUB_CREATE_IN_ORG', false) || '');
  const description = 'Educational web studio → Capacitor mobile (auto-generated)';

  if (useOrg) {
    await octokit.repos.createInOrg({
      org: owner,
      name,
      description,
      private: true,
      auto_init: true,
      has_issues: false,
      has_projects: false,
      has_wiki: false
    });
  } else {
    await octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: true,
      auto_init: true,
      has_issues: false,
      has_projects: false,
      has_wiki: false
    });
  }
  return true;
}

async function pushTreeCommit(octokit, owner, repo, filesMap, message) {
  const branch = defaultBranch();
  const ref = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const baseSha = ref.data.object.sha;
  const baseCommit = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
  const baseTreeSha = baseCommit.data.tree.sha;

  const treeItems = [];
  for (const [path, content] of Object.entries(filesMap)) {
    const blob = await octokit.git.createBlob({
      owner,
      repo,
      content: Buffer.from(content, 'utf8').toString('base64'),
      encoding: 'base64'
    });
    treeItems.push({
      path,
      mode: '100644',
      type: 'blob',
      sha: blob.data.sha
    });
  }

  const tree = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeItems
  });

  const commit = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: tree.data.sha,
    parents: [baseSha]
  });

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.data.sha
  });

  return commit.data.sha;
}

/** Single commit updating www/index.html, www/css/app.css, www/js/app.js */
async function pushWwwFilesCommit(octokit, owner, repo, html, css, js, message) {
  const branch = defaultBranch();
  const ref = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const baseSha = ref.data.object.sha;
  const baseCommit = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
  const baseTreeSha = baseCommit.data.tree.sha;

  const paths = [
    ['www/index.html', html],
    ['www/css/app.css', css],
    ['www/js/app.js', js]
  ];
  const treeItems = [];
  for (const [path, content] of paths) {
    const blob = await octokit.git.createBlob({
      owner,
      repo,
      content: Buffer.from(content, 'utf8').toString('base64'),
      encoding: 'base64'
    });
    treeItems.push({ path, mode: '100644', type: 'blob', sha: blob.data.sha });
  }

  const tree = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeItems
  });

  const commit = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: tree.data.sha,
    parents: [baseSha]
  });

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.data.sha
  });

  return commit.data.sha;
}

const scaffoldDone = new Set();

async function ensureScaffoldOnRemote(octokit, owner, repo, studentId) {
  const key = `${owner}/${repo}`;
  if (scaffoldDone.has(key)) return;

  const hasWww = await getFileSha(octokit, owner, repo, 'www/index.html');
  if (hasWww) {
    scaffoldDone.add(key);
    return;
  }

  const appId = appIdForStudent(studentId);
  const files = buildScaffoldFiles({
    studentId,
    appId: appId.length >= 5 ? appId : DEFAULT_APP_ID
  });

  await pushTreeCommit(
    octokit,
    owner,
    repo,
    files,
    'chore: add Capacitor 6 scaffold + GitHub Actions (educational studio)'
  );
  scaffoldDone.add(key);
}

/**
 * Overwrite student www files and create one commit (triggers CI once).
 */
export async function syncToGithub(studentId, html, css, js) {
  const octokit = createOctokit();
  const owner = getOwner();
  const repo = repoNameForStudent(studentId);

  await ensureRepository(octokit, owner, repo);
  await ensureScaffoldOnRemote(octokit, owner, repo, studentId);

  const msg = `chore: sync student www (${new Date().toISOString()})`;
  await pushWwwFilesCommit(octokit, owner, repo, html, css, js, msg);

  return { owner, repo, branch: defaultBranch() };
}

/**
 * Latest workflow run + GitHub API artifact download URL (requires Authorization: Bearer PAT).
 */
export async function checkBuildStatus(studentId) {
  const octokit = createOctokit();
  const owner = getOwner();
  const repo = repoNameForStudent(studentId);
  const wfName = workflowFile();

  const { data: workflows } = await octokit.actions.listRepoWorkflows({ owner, repo });
  const def =
    workflows.workflows.find((w) => w.path === `.github/workflows/${wfName}`) ||
    workflows.workflows.find((w) => /build mobile/i.test(w.name || ''));

  if (!def) {
    return {
      status: 'unknown',
      conclusion: null,
      message: `Workflow .github/workflows/${wfName} not found.`,
      artifactUrl: null,
      artifacts: []
    };
  }

  const { data: runs } = await octokit.actions.listWorkflowRuns({
    owner,
    repo,
    workflow_id: def.id,
    per_page: 1
  });

  const run = runs.workflow_runs[0];
  if (!run) {
    return {
      status: 'none',
      conclusion: null,
      message: 'No workflow runs yet.',
      artifactUrl: null,
      artifacts: []
    };
  }

  const status = run.status;
  const conclusion = run.conclusion;

  let artifacts = [];
  let artifactUrl = null;

  if (status === 'completed' && conclusion === 'success') {
    const { data: arts } = await octokit.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: run.id,
      per_page: 50
    });
    artifacts = arts.artifacts.map((a) => ({
      id: a.id,
      name: a.name,
      size_in_bytes: a.size_in_bytes,
      expired: a.expired,
      archive_download_url: a.archive_download_url
    }));

    const androidArt =
      arts.artifacts.find((a) => a.name === 'android-debug-apk') ||
      arts.artifacts.find((a) => /android.*apk/i.test(a.name));

    if (androidArt?.archive_download_url) {
      artifactUrl = androidArt.archive_download_url;
    }
  }

  return {
    status,
    conclusion,
    workflowRunId: run.id,
    htmlUrl: run.html_url,
    message: run.name || '',
    artifactUrl,
    artifacts,
    note:
      'artifactUrl is a GitHub API URL. Download with header: Authorization: Bearer <same PAT> and Accept: application/vnd.github+json'
  };
}
