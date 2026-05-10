# Manual: Building Android APK and iOS project from the HTML studio

This guide explains how to turn student HTML/CSS/JS from the **Yarub HTML Playground** (or any source that can supply those three strings) into installable **Android** output and an **iOS Xcode project** using the **mobile-sync-backend** service and **GitHub Actions**.

---

## 1. What you get

| Platform | Output | Notes |
|----------|--------|--------|
| **Android** | **Debug APK** inside a GitHub Actions **artifact** zip | Built automatically on each successful sync push to `main`. Suitable for sideloading / testing (not Play Store release without further signing and store setup). |
| **iOS** | **Xcode project zip** (`ios-app-project` artifact) and an optional **simulator** build step | This is **not** an **IPA** for physical devices or TestFlight. Real device distribution requires **Apple Developer** certificates, provisioning profiles, and archiving in Xcode (or a dedicated release CI job). |

---

## 2. Prerequisites

1. **GitHub account** (or organization) where new repositories can be created for each student.
2. A **Personal Access Token (classic)** with at least:
   - **`repo`** — create/update private repos and push code  
   - **`workflow`** — useful if workflows need to be enabled or re-run  
   - **`read:actions`** (or broader **Actions** read access) — list workflow runs and download artifact URLs  
3. **Node.js 18+** on the machine where you run the backend.
4. **Network**: the server running this backend must reach `api.github.com`.

---

## 3. Install and run the backend

```bash
cd mobile-sync-backend
cp .env.example .env
```

Edit **`.env`**:

- **`GITHUB_TOKEN`** — your PAT (keep secret; never put it in frontend code).  
- **`GITHUB_OWNER`** — GitHub username or org name that will own the student repos.  
- **`GITHUB_REPO_PREFIX`** — optional; default `webstudio-student-` (repo name becomes `prefix` + sanitized `studentId`).  
- **`PORT`** — optional; default `3847`.

For **organization-owned** repos, set **`GITHUB_CREATE_IN_ORG=1`** in `.env` and use a token that can create repos in that org.

Then:

```bash
npm install
npm start
```

Confirm: open `http://localhost:3847/health` — you should see `{"ok":true,...}`.

---

## 4. Prepare HTML, CSS, and JavaScript

The API expects **three separate strings**:

- **`html`** — full document or fragment that will be written to **`www/index.html`** (the playground’s single-file project must be **split** into page HTML, styles, and scripts, or you maintain `index.html` with `<link href="css/app.css">` and `<script src="js/app.js">` in the Capacitor `www` layout).

- **`css`** — contents of **`www/css/app.css`**.

- **`js`** — contents of **`www/js/app.js`**.

**Example:** If the student only has one `index.html` with inline `<style>` and `<script>`, copy those blocks into `app.css` and `app.js`, and keep a small `index.html` that links to them (matching the scaffold in `src/scaffold.js`).

---

## 5. Sync a student project to GitHub

**Endpoint:** `POST /sync-to-github`  
**Body (JSON):** `{ "studentId", "html", "css", "js" }`

Example with `curl` (replace values and use your server URL if not local):

```bash
curl -sS -X POST "http://localhost:3847/sync-to-github" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student-01",
    "html": "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>App</title><link rel=\"stylesheet\" href=\"css/app.css\"></head><body><h1>Hello</h1><script type=\"module\" src=\"js/app.js\"></script></body></html>",
    "css": "body { font-family: system-ui; margin: 1rem; }",
    "js": "console.log(\"loaded\");"
  }'
```

**First time** for that `studentId`, the service:

1. Creates a **private** repo (name from prefix + id).  
2. Pushes the **Capacitor 6** scaffold (including **`.github/workflows/build.yml`**).  
3. Commits your **`www/index.html`**, **`www/css/app.css`**, **`www/js/app.js`**.

Each later sync adds **one new commit** with updated `www` files. Pushes to **`main`** trigger **GitHub Actions**.

**Response** includes `repoUrl` — open it to verify files and the **Actions** tab.

---

## 6. Enable and watch GitHub Actions

- In the student repo on GitHub, open **Actions**.  
- If workflows are disabled (org policy), **enable** them for this repository.  
- Workflow name is along the lines of **“Build mobile apps”**; file: **`.github/workflows/build.yml`**.

The workflow has two jobs:

- **android** — produces artifact **`android-debug-apk`** (contains `app-debug.apk`).  
- **ios** — uploads **`ios-app-project`** (zip of the Xcode project folder to open on a Mac).

Typical runtime: several minutes for Android; iOS job runs on macOS and may show warnings or optional simulator build steps.

---

## 7. Check build status from the API

**Endpoint:** `GET /check-build-status/:studentId`

```bash
curl -sS "http://localhost:3847/check-build-status/student-01"
```

When the latest run **completed** successfully and an Android artifact exists:

- **`ready`** is `true`  
- **`artifactUrl`** is the GitHub API URL to download the **artifact zip** (not a direct public link).

Fields **`status`**, **`conclusion`**, **`htmlUrl`**, and **`artifacts`** help debugging failed runs.

---

## 8. Download the Android APK (artifact zip)

GitHub requires authentication to download **`archive_download_url`**.

Replace `ARTIFACT_URL` with the value of **`artifactUrl`** from the JSON (or from the API’s `artifacts[].archive_download_url` for `android-debug-apk`).

```bash
export GITHUB_TOKEN="ghp_xxxxxxxx"   # same kind of token as in .env
export ARTIFACT_URL="https://api.github.com/repos/OWNER/REPO/actions/artifacts/ARTIFACT_ID/zip"

curl -sS -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -o android-debug-apk.zip \
  "$ARTIFACT_URL"
```

Unzip **`android-debug-apk.zip`**; inside you should find **`app-debug.apk`**. Transfer it to a device and install for testing (Android may require allowing install from unknown sources for debug builds).

---

## 9. iOS: from artifact to Xcode (and why there is no IPA here)

1. In the GitHub **Actions** run for the student repo, open the **ios** job artifacts and download **`ios-app-project`** (or use the GitHub API similarly with the artifact’s `archive_download_url`).  
2. Unzip on a **Mac**.  
3. Open **`App.xcworkspace`** (under the unzipped `ios/App` layout) in **Xcode**.  
4. Choose a **simulator** or a **physical device** (physical device requires your **Team** / signing in Xcode).

To produce an **IPA** for devices or TestFlight you must:

- Enroll in the **Apple Developer Program**.  
- Configure **signing & capabilities** in Xcode (or use **fastlane** / CI with certificates and provisioning profiles).  

That release pipeline is **outside** this educational scaffold; the included workflow only prepares the project and optional simulator-oriented build attempts.

---

## 10. Connect the Yarub HTML Playground in the browser

- The playground must call **your** backend URL (same origin or CORS-enabled server), **not** GitHub directly, so the **PAT never appears in the browser**.  
- Your integration should collect or derive **`html`**, **`css`**, and **`js`** from the editor state, then `POST` them to **`/sync-to-github`**.  
- Optionally poll **`/check-build-status/:studentId`** and surface **`htmlUrl`** or download links via a **server-side** step that uses the PAT.

---

## 11. Troubleshooting

| Problem | What to check |
|--------|----------------|
| **403 / 401** from GitHub | Token scopes (`repo`, `read:actions`), token not expired, `GITHUB_OWNER` matches repo owner. |
| **Workflow not found** | First push included `.github/workflows/build.yml`; branch is **`main`** (or matches `DEFAULT_BRANCH`). |
| **No workflow runs** | Actions disabled on repo or org; enable in repo **Settings → Actions**. |
| **`ready: false` forever** | Open **`htmlUrl`** from the API response; fix Gradle/Xcode errors in logs. |
| **Empty or missing APK in artifact** | Android job failed before `assembleDebug`; read the **android** job log. |
| **Student repo name wrong** | `studentId` is sanitized; check `repo` field in `check-build-status` response. |

---

## 12. Security reminders

- Treat **`GITHUB_TOKEN`** like a password: **`.env`** only, secure server, no client-side exposure.  
- Student repos are created **private** by default; review org policies for compliance.  
- Debug APKs are for **testing**; distributing to the public store needs a separate release and signing process.

---

## Further reading

- Service overview and env table: **`README.md`** in this folder.  
- Workflow and scaffold definitions: **`src/scaffold.js`**.  
- Status and artifact logic: **`src/githubSync.js`**.
