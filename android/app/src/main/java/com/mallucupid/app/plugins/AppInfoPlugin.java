package com.mallucupid.app.plugins;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "McAppInfo")
public class AppInfoPlugin extends Plugin {

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        try {
            Context ctx = getContext();
            PackageManager pm = ctx.getPackageManager();
            String pkg = ctx.getPackageName();
            PackageInfo info = pm.getPackageInfo(pkg, 0);
            JSObject ret = new JSObject();
            ret.put("versionName", info.versionName != null ? info.versionName : "");
            ret.put("versionCode", Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode);
            ret.put("packageName", pkg);
            ret.put("firstInstallTime", info.firstInstallTime);
            ret.put("lastUpdateTime", info.lastUpdateTime);
            ret.put("buildVersionSDK", Build.VERSION.SDK_INT);
            ret.put("buildVersionRelease", Build.VERSION.RELEASE);
            String installer = null;
            try {
                if (Build.VERSION.SDK_INT >= 30) installer = pm.getInstallSourceInfo(pkg).getInstallingPackageName();
                else installer = pm.getInstallerPackageName(pkg);
            } catch (Throwable ignored) {}
            ret.put("installerPackage", installer != null ? installer : "");
            call.resolve(ret);
        } catch (Throwable t) { call.reject("getAppInfo failed: " + t.getMessage()); }
    }

    @PluginMethod
    public void openPlayStore(PluginCall call) {
        try {
            String pkg = getContext().getPackageName();
            Uri marketUri = Uri.parse("market://details?id=" + pkg);
            Intent intent = new Intent(Intent.ACTION_VIEW, marketUri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (intent.resolveActivity(getContext().getPackageManager()) != null) {
                getContext().startActivity(intent);
            } else {
                Intent webIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + pkg));
                webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(webIntent);
            }
            JSObject ret = new JSObject(); ret.put("opened", true); call.resolve(ret);
        } catch (Throwable t) {
            JSObject ret = new JSObject(); ret.put("opened", false); ret.put("reason", t.getMessage() != null ? t.getMessage() : "error"); call.resolve(ret);
        }
    }

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        try {
            Context ctx = getContext();
            PackageInfo info = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            JSObject ret = new JSObject();
            ret.put("available", "unknown");
            ret.put("installedVersionName", info.versionName);
            ret.put("installedVersionCode", Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode);
            ret.put("hint", "Call openPlayStore() to let the user check for updates manually.");
            call.resolve(ret);
        } catch (Throwable t) { call.reject("checkForUpdate failed: " + t.getMessage()); }
    }
}
