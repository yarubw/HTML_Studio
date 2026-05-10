/**
 * Static Capacitor 6 + CI scaffold (file path -> content).
 * www/ holds student HTML/CSS/JS; CI runs cap sync + native builds.
 */

export const DEFAULT_APP_ID = 'com.edustudio.studentapp';

export function buildScaffoldFiles({ studentId, appId = DEFAULT_APP_ID }) {
  const safeId = String(studentId).replace(/[^a-zA-Z0-9_-]/g, '-');

  const packageJson = {
    name: `student-app-${safeId}`,
    private: true,
    version: '1.0.0',
    type: 'module',
    scripts: {
      build: 'node scripts/noop-build.mjs',
      'cap:sync': 'npx cap sync',
      'cap:android': 'npx cap sync android',
      'cap:ios': 'npx cap sync ios'
    },
    dependencies: {
      '@capacitor/android': '^6.1.2',
      '@capacitor/cli': '^6.1.2',
      '@capacitor/core': '^6.1.2',
      '@capacitor/ios': '^6.1.2'
    },
    devDependencies: {
      typescript: '^5.6.3'
    }
  };

  const capacitorConfig = {
    appId,
    appName: `Student ${safeId}`,
    webDir: 'www',
    bundledWebRuntime: false
  };

  const wwwIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Student App</title>
  <link rel="stylesheet" href="css/app.css" />
</head>
<body>
  <div id="app"></div>
  <script type="module" src="js/app.js"></script>
</body>
</html>
`;

  const wwwCss = `/* Student CSS — replaced on sync */\nbody { font-family: system-ui, sans-serif; margin: 1rem; }\n`;

  const wwwJs = `// Student JS — replaced on sync\nconsole.log('Student app loaded');\n`;

  const noopBuild = `#!/usr/bin/env node\n// Placeholder: web assets live directly in www/\nconsole.log('build: www/ is ready');\n`;

  const injectManifestPy = `#!/usr/bin/env python3
"""Inject Camera, Microphone, and GPS permissions after opening <manifest>."""
from __future__ import annotations

import pathlib
import re

MAN = pathlib.Path("android/app/src/main/AndroidManifest.xml")
PERMS = """    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
"""

def main() -> None:
    text = MAN.read_text(encoding="utf-8")
    if "android.permission.CAMERA" in text:
        print("Permissions already present")
        return

    def inject(m):
        return m.group(1) + chr(10) + PERMS

    new, n = re.subn(r"(<manifest[^>]*>)", inject, text, count=1, flags=re.DOTALL)
    if n != 1:
        raise SystemExit("Could not find <manifest> root")
    MAN.write_text(new, encoding="utf-8")
    print("Injected Android permissions")

if __name__ == "__main__":
    main()
`;

  const gitignore = `node_modules/\n.DS_Store\nandroid/app/build/\nandroid/.gradle/\nandroid/build/\nios/App/build/\nios/DerivedData/\n*.log\n.env\n`;

  const workflowYml = buildWorkflowYml();

  return {
    'package.json': JSON.stringify(packageJson, null, 2) + '\n',
    'capacitor.config.json': JSON.stringify(capacitorConfig, null, 2) + '\n',
    'www/index.html': wwwIndexHtml,
    'www/css/app.css': wwwCss,
    'www/js/app.js': wwwJs,
    'scripts/noop-build.mjs': noopBuild,
    'scripts/inject-android-manifest.py': injectManifestPy,
    '.gitignore': gitignore,
    '.github/workflows/build.yml': workflowYml
  };
}

function buildWorkflowYml() {
  return `name: Build mobile apps

on:
  push:
    branches:
      - main

permissions:
  contents: read
  actions: read

jobs:
  android:
    name: Android APK
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Sync Capacitor (Android)
        run: npx cap sync android

      - name: Inject Android permissions (Camera, Mic, GPS)
        shell: bash
        run: |
          set -euo pipefail
          test -f android/app/src/main/AndroidManifest.xml
          python3 scripts/inject-android-manifest.py

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Assemble Debug APK
        working-directory: android
        run: chmod +x gradlew && ./gradlew assembleDebug --no-daemon

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: android-debug-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
          if-no-files-found: error

  ios:
    name: iOS (simulator build)
    runs-on: macos-14
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Sync Capacitor (iOS)
        run: npx cap sync ios

      - name: Build iOS (Simulator — optional, no signing)
        continue-on-error: true
        env:
          DEVELOPER_DIR: /Applications/Xcode.app/Contents/Developer
        run: |
          set -euo pipefail
          cd ios/App
          xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' build CODE_SIGNING_ALLOWED=NO || \\
          xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15' build CODE_SIGNING_ALLOWED=NO

      - name: Zip iOS project (open in Xcode on a Mac)
        if: always()
        run: |
          set -euo pipefail
          (cd ios/App && zip -r "$GITHUB_WORKSPACE/ios-app-project.zip" . -x '**/build/*' -x '**/DerivedData/*' -x '**/.git/*')

      - name: Upload iOS artifact
        uses: actions/upload-artifact@v4
        with:
          name: ios-app-project
          path: ios-app-project.zip
          if-no-files-found: warn
`;
}
