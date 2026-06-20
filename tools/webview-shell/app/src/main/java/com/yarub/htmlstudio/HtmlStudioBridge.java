package com.yarub.htmlstudio;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

public class HtmlStudioBridge {
    private final Activity activity;

    public HtmlStudioBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean isAndroidApp() {
        return true;
    }

    @JavascriptInterface
    public boolean hasCameraPermission() {
        return activity.checkSelfPermission(android.Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED;
    }

    @JavascriptInterface
    public boolean hasMicrophonePermission() {
        return activity.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
    }

    @JavascriptInterface
    public boolean hasLocationPermission() {
        return activity.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
                || activity.checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    @JavascriptInterface
    public void openAppSettings() {
        activity.runOnUiThread(() -> {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", activity.getPackageName(), null));
            activity.startActivity(intent);
        });
    }

    @JavascriptInterface
    public void requestCameraPermission() {
        requestPermissions(new String[]{android.Manifest.permission.CAMERA});
    }

    @JavascriptInterface
    public void requestMicrophonePermission() {
        requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO});
    }

    @JavascriptInterface
    public void requestLocationPermission() {
        requestPermissions(new String[]{
                android.Manifest.permission.ACCESS_FINE_LOCATION,
                android.Manifest.permission.ACCESS_COARSE_LOCATION
        });
    }

    private void requestPermissions(String[] permissions) {
        activity.runOnUiThread(() -> {
            if (activity instanceof MainActivity) {
                ((MainActivity) activity).requestAndroidPermissions(permissions);
            }
        });
    }
}
