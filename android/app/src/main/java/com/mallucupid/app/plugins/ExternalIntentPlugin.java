package com.mallucupid.app.plugins;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.URLUtil;
import android.widget.Toast;

import androidx.annotation.Nullable;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ExternalIntent")
public class ExternalIntentPlugin extends Plugin {

    @Nullable
    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        if (url == null) return null;
        String scheme = url.getScheme();
        if (scheme == null) return null;
        if (!"intent".equalsIgnoreCase(scheme)) return null;
        try {
            Intent intent = Intent.parseUri(url.toString(), Intent.URI_INTENT_SCHEME);
            intent.removeCategory(Intent.CATEGORY_BROWSABLE);
            intent.setComponent(null);
            Context ctx = getContext();
            if (intent.resolveActivity(ctx.getPackageManager()) != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
                return Boolean.TRUE;
            }
            String fallback = intent.getStringExtra("browser_fallback_url");
            if (fallback != null && URLUtil.isNetworkUrl(fallback)) {
                try {
                    Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(fallback));
                    browser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(browser);
                    return Boolean.TRUE;
                } catch (ActivityNotFoundException ignored) {}
            }
            Toast.makeText(ctx, ctx.getString(com.mallucupid.app.R.string.mc_no_app_to_handle), Toast.LENGTH_LONG).show();
            return Boolean.TRUE;
        } catch (java.net.URISyntaxException | ActivityNotFoundException | SecurityException e) {
            return null;
        }
    }
}
