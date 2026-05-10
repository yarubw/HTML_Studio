# Sync to Mobile — backend service

Node.js / Express service that:

1. **Scaffolds** a per-student GitHub repository with **Capacitor 6**, `www/` for web assets, and **GitHub Actions** to build an **Android debug APK** (Ubuntu) and an **iOS simulator build** (macOS).
2. **`syncToGithub(studentId, html, css, js)`** — ensures the repo exists, applies the scaffold on first use, then commits **`www/index.html`**, **`www/css/app.css`**, and **`www/js/app.js`** in a **single commit** (one CI run per sync).
3. **Android permissions** — CI runs `npx cap sync android`, then **`scripts/inject-android-manifest.py`** to add Camera, Microphone, and GPS permissions to `AndroidManifest.xml`.
4. **`GET /check-build-status/:studentId`** — reads the latest **workflow run**; when `completed` + `success`, returns the **artifact** `archive_download_url` for the Android APK zip (GitHub API; requires `Authorization` with the same PAT).

## Setup

```bash
cd mobile-sync-backend
cp .env.example .env
# Edit .env: GITHUB_TOKEN (repo + workflow + actions:read), GITHUB_OWNER, optional GITHUB_REPO_PREFIX
npm install
npm start
```

### GitHub token scopes

- `repo` (full control of private repositories) — to push and create repos  
- `workflow` — if you need to trigger workflows manually (not required for push-triggered builds)  
- `read:actions` or full `actions:read` — to list workflow runs and artifacts  

For **org-owned** student repos, set `GITHUB_CREATE_IN_ORG=1` and use an org admin PAT; the service calls `repos.createInOrg`.

### Environment variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | PAT |
| `GITHUB_OWNER` | User or org name |
| `GITHUB_REPO_PREFIX` | Prefix for repo names (default `webstudio-student-`) |
| `GITHUB_CREATE_IN_ORG` | `1` / `true` to use `createInOrg` |
| `DEFAULT_BRANCH` | Default `main` (must match workflow) |
| `WORKFLOW_FILE` | Default `build.yml` |
| `PORT` | Default `3847` |

## HTTP API

### `POST /sync-to-github`

```json
{
  "studentId": "alice-42",
  "html": "<!DOCTYPE html><html>...</html>",
  "css": "body { margin: 0; }",
  "js": "console.log(1);"
}
```

### `GET /check-build-status/:studentId`

Response when the Android job succeeded:

- `ready: true`
- `artifactUrl`: GitHub Actions **artifact** download URL  
- Clients must request it with:

```http
GET <artifactUrl>
Authorization: Bearer <GITHUB_TOKEN>
Accept: application/vnd.github+json
```

GitHub responds with a redirect to the actual zip storage.

## Capacitor & CI

Scaffold and workflow are generated in **`src/scaffold.js`** (including `.github/workflows/build.yml`). After the first push, **enable GitHub Actions** on the repo if your org disables workflows by default.

### iOS note

The workflow attempts a **simulator** `xcodebuild` with `CODE_SIGNING_ALLOWED=NO`. Real device / App Store builds need signing assets and are not covered here.

## Integrating your web studio

From the browser, call your **own backend** (this service) via `fetch` to avoid exposing the PAT. Example:

```js
await fetch('https://your-school-server/sync-to-github', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    studentId,
    html: editorHtml,
    css: editorCss,
    js: editorJs
  })
});
```
