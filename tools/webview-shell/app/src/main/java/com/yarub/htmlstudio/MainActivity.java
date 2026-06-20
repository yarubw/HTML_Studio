package com.yarub.htmlstudio;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class MainActivity extends Activity {
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int PERMISSION_REQUEST_JS_CODE = 1002;
    private static final String APP_ENTRY =
            "https://appassets.androidplatform.net/assets/www/index.html";

    private WebView webView;
    private PermissionRequest pendingPermissionRequest;
    private String[] pendingJsPermissions;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setGeolocationEnabled(true);

        webView.addJavascriptInterface(new HtmlStudioBridge(this), "HtmlStudioAndroid");

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> handleWebPermissionRequest(request));
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(
                    String origin, GeolocationPermissions.Callback callback) {
                if (hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                        || hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)) {
                    callback.invoke(origin, true, false);
                    return;
                }
                pendingGeolocationCallback = callback;
                pendingGeolocationOrigin = origin;
                requestPermissions(
                        new String[]{
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                        },
                        PERMISSION_REQUEST_CODE + 3);
            }
        });

        webView.loadUrl(APP_ENTRY);
    }

    private GeolocationPermissions.Callback pendingGeolocationCallback;
    private String pendingGeolocationOrigin;

    public void requestAndroidPermissions(String[] permissions) {
        pendingJsPermissions = permissions;
        requestPermissions(permissions, PERMISSION_REQUEST_JS_CODE);
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        List<String> needed = androidPermissionsForWebResources(request.getResources());
        if (needed.isEmpty()) {
            request.grant(request.getResources());
            return;
        }
        pendingPermissionRequest = request;
        requestPermissions(needed.toArray(new String[0]), PERMISSION_REQUEST_CODE);
    }

    private List<String> androidPermissionsForWebResources(String[] webResources) {
        Set<String> needed = new HashSet<>();
        for (String resource : webResources) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)
                    && !hasPermission(Manifest.permission.CAMERA)) {
                needed.add(Manifest.permission.CAMERA);
            }
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                    && !hasPermission(Manifest.permission.RECORD_AUDIO)) {
                needed.add(Manifest.permission.RECORD_AUDIO);
            }
        }
        return new ArrayList<>(needed);
    }

    private boolean hasPermission(String permission) {
        return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == PERMISSION_REQUEST_CODE && pendingPermissionRequest != null) {
            PermissionRequest request = pendingPermissionRequest;
            pendingPermissionRequest = null;
            if (allGranted(grantResults)) {
                request.grant(request.getResources());
            } else {
                request.deny();
                showPermissionDeniedDialog(permissions);
            }
            return;
        }

        if (requestCode == PERMISSION_REQUEST_JS_CODE) {
            pendingJsPermissions = null;
            if (!allGranted(grantResults)) {
                showPermissionDeniedDialog(permissions);
            }
            return;
        }

        if (requestCode == PERMISSION_REQUEST_CODE + 3 && pendingGeolocationCallback != null) {
            GeolocationPermissions.Callback callback = pendingGeolocationCallback;
            String origin = pendingGeolocationOrigin;
            pendingGeolocationCallback = null;
            pendingGeolocationOrigin = null;
            boolean granted = allGranted(grantResults);
            callback.invoke(origin, granted, false);
            if (!granted) {
                showPermissionDeniedDialog(permissions);
            }
        }
    }

    private void showPermissionDeniedDialog(String[] permissions) {
        String label = permissionLabel(permissions);
        new AlertDialog.Builder(this)
                .setTitle(label + " permission needed")
                .setMessage("Allow " + label.toLowerCase()
                        + " access for this app in Settings, then try again.")
                .setPositiveButton("Open Settings", (dialog, which) -> openAppSettings())
                .setNegativeButton("Cancel", null)
                .show();
    }

    private String permissionLabel(String[] permissions) {
        if (permissions == null || permissions.length == 0) {
            return "Permission";
        }
        String p = permissions[0];
        if (Manifest.permission.CAMERA.equals(p)) {
            return "Camera";
        }
        if (Manifest.permission.RECORD_AUDIO.equals(p)) {
            return "Microphone";
        }
        if (Manifest.permission.ACCESS_FINE_LOCATION.equals(p)
                || Manifest.permission.ACCESS_COARSE_LOCATION.equals(p)) {
            return "Location";
        }
        return "Permission";
    }

    private void openAppSettings() {
        new HtmlStudioBridge(this).openAppSettings();
    }

    private boolean allGranted(int[] grantResults) {
        if (grantResults == null || grantResults.length == 0) {
            return false;
        }
        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        return true;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
