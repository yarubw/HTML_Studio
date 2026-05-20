# APK Builder Server

Node.js backend for the student HTML playground **Export APK** feature. It accepts a project ZIP, pushes assets into the [apk-builder](https://github.com/yarubw/apk-builder) Android template on a temporary branch, triggers GitHub Actions, and serves the built APK.

## Requirements

- Node.js 18+
- `git` CLI
- SSH access to `git@github.com:yarubw/apk-builder.git` (deploy key or your SSH key with repo write access)
- A GitHub Personal Access Token (classic or fine-grained) with:
  - **repo** — read/write the apk-builder repository
  - **workflow** / **actions** — trigger workflows and download artifacts

Never put `GITHUB_TOKEN` in the frontend. It lives only in `server/.env`.

## Setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env and set GITHUB_TOKEN
npm run dev
```

Server URL: **http://localhost:3000**

The playground frontend calls:

- `POST http://localhost:3000/api/build`
- `GET http://localhost:3000/api/job/:jobId`
- `GET http://localhost:3000/apks/:jobId.apk` (after success)

## API

### `POST /api/build`

`multipart/form-data`:

| Field    | Description        |
|----------|--------------------|
| `appName` | Android app label |
| `appIcon` | Launcher icon (PNG/JPEG/WebP, max 2MB, square recommended) |
| `zipFile` | Project ZIP (max 20MB, must include root `index.html`) |

Response: `{ "jobId": "..." }`

### `GET /api/job/:jobId`

```json
{
  "id": "...",
  "status": "queued | building | success | failed",
  "apkUrl": "/apks/....apk",
  "error": null
}
```

## Build flow (one job at a time)

1. Validate ZIP (size, `index.html` at root, allowed extensions, no zip-slip paths).
2. Clone `apk-builder` into `server/temp/{jobId}/`.
3. Replace `app/src/main/assets/www/` with ZIP contents.
4. Update `app_name` in `app/src/main/res/values/strings.xml`.
5. Apply uploaded icon to launcher mipmaps and adaptive icon XML.
6. Push branch `build-{jobId}` and trigger workflow `build-apk.yml` on that ref.
7. Poll GitHub Actions until the run completes.
8. Download the workflow artifact, extract the `.apk`, save to `server/public/apks/{jobId}.apk`.
9. Delete temp folder and optionally the remote branch.

Only files under `server/public/apks/` are served statically.

## Troubleshooting

- **Clone failed** — ensure SSH works: `ssh -T git@github.com` and the key can push to `yarubw/apk-builder`.
- **Workflow not found** — confirm `GITHUB_WORKFLOW=build-apk.yml` exists on the default branch.
- **Artifact empty** — ensure the workflow uploads an artifact containing a `.apk` file.
