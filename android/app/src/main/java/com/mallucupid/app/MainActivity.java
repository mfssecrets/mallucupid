package com.mallucupid.app;

import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

import com.mallucupid.app.plugins.ExternalIntentPlugin;
import com.mallucupid.app.plugins.ToastPlugin;
import com.mallucupid.app.plugins.RatePromptPlugin;
import com.mallucupid.app.plugins.AppInfoPlugin;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * MalluCupid main Activity. Extends Capacitor's BridgeActivity with native-only
 * enhancements: back-button navigation, branded offline/error overlays, JS
 * bridge injection, notification channels, FLAG_SECURE, WebView tuning.
 * src/ stays 100% untouched.
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "MalluCupid";

    @SuppressLint("MissingSuperCall")
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExternalIntentPlugin.class);
        registerPlugin(ToastPlugin.class);
        registerPlugin(RatePromptPlugin.class);
        registerPlugin(AppInfoPlugin.class);

        super.onCreate(savedInstanceState);

        createNotificationChannels();
        try { getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE); } catch (Throwable ignored) {}
        tuneWebView();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            private long lastBackPress = 0;
            private static final long EXIT_WINDOW_MS = 2500;
            @Override
            public void handleOnBackPressed() {
                WebView webView = (bridge != null) ? bridge.getWebView() : null;
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    long now = System.currentTimeMillis();
                    if (now - lastBackPress < EXIT_WINDOW_MS) moveTaskToBack(true);
                    else { lastBackPress = now; showExitToast(); }
                }
            }
            private void showExitToast() {
                try { android.widget.Toast.makeText(MainActivity.this, "Press back again to exit", android.widget.Toast.LENGTH_SHORT).show(); } catch (Throwable ignored) {}
            }
        });

        if (bridge != null) {
            bridge.addWebViewListener(new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    String bridgeJs = readAsset("mc-native-bridge.js");
                    if (bridgeJs != null) webView.evaluateJavascript(bridgeJs, null);
                    webView.evaluateJavascript(OFFLINE_OVERLAY_JS, null);
                    webView.evaluateJavascript(ERROR_SCREEN_JS, null);
                }
                @Override
                public void onReceivedError(WebView webView) {
                    webView.evaluateJavascript(ERROR_SCREEN_JS, null);
                }
            });
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        try {
            NotificationChannel reminders = new NotificationChannel("mallucupid-reminders", "MalluCupid Reminders", NotificationManager.IMPORTANCE_DEFAULT);
            reminders.setDescription("Scheduled reminders from MalluCupid.");
            reminders.enableLights(true); reminders.setLightColor(0xFFF43F5E); reminders.enableVibration(true); reminders.setShowBadge(true);
            nm.createNotificationChannel(reminders);
            NotificationChannel chat = new NotificationChannel("mallucupid-chat", "Chat & Messages", NotificationManager.IMPORTANCE_HIGH);
            chat.setDescription("New chat messages and creator updates.");
            chat.enableLights(true); chat.setLightColor(0xFFF43F5E); chat.enableVibration(true); chat.setShowBadge(true);
            nm.createNotificationChannel(chat);
            NotificationChannel general = new NotificationChannel("mallucupid-general", "General", NotificationManager.IMPORTANCE_LOW);
            general.setDescription("General app notifications."); general.setShowBadge(false);
            nm.createNotificationChannel(general);
        } catch (Throwable ignored) {}
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void tuneWebView() {
        try {
            WebView webView = (bridge != null) ? bridge.getWebView() : null;
            if (webView == null) return;
            android.webkit.WebSettings settings = webView.getSettings();
            try { settings.setDatabaseEnabled(true); } catch (Throwable ignored) {}
            try { settings.setCacheMode(android.webkit.WebSettings.LOAD_DEFAULT); } catch (Throwable ignored) {}
            try { settings.setDefaultTextEncodingName("UTF-8"); } catch (Throwable ignored) {}
            try { settings.setLoadWithOverviewMode(true); } catch (Throwable ignored) {}
            try { settings.setUseWideViewPort(true); } catch (Throwable ignored) {}
            try { settings.setAllowFileAccess(true); } catch (Throwable ignored) {}
            try { settings.setAllowContentAccess(true); } catch (Throwable ignored) {}
        } catch (Throwable ignored) {}
    }

    private String readAsset(String name) {
        try (InputStream is = getAssets().open(name)) {
            byte[] buf = new byte[is.available()];
            int read = is.read(buf);
            if (read <= 0) return null;
            return new String(buf, 0, read, StandardCharsets.UTF_8);
        } catch (IOException e) {
            android.util.Log.w(TAG, "Could not read asset " + name + ": " + e.getMessage());
            return null;
        }
    }

    private static final String OFFLINE_OVERLAY_JS =
"(function(){" +
"  if (window.__mcOfflineInjected) return; window.__mcOfflineInjected = true;" +
"  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;" +
"  var ns='https://www.w3.org/2000/svg';" +
"  var ov=document.createElement('div');" +
"  ov.id='mc-offline-overlay';" +
"  ov.style.cssText='position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:32px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:radial-gradient(120% 120% at 50% 0%,#1a1a22 0%,#0b0b0f 60%,#000 100%);color:#fff;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);'+(reduce?'':'animation:mcFade .25s ease-out');" +
"  var card=document.createElement('div');" +
"  card.style.cssText='max-width:420px;width:100%;text-align:center;border-radius:28px;padding:44px 30px;background:linear-gradient(180deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.02) 100%);border:1px solid rgba(244,63,94,0.22);box-shadow:0 28px 70px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.04)';" +
"  var wrap=document.createElement('div');" +
"  wrap.style.cssText='position:relative;width:104px;height:104px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center';" +
"  if(!reduce){for(var r=0;r<3;r++){var ring=document.createElement('div');ring.style.cssText='position:absolute;inset:0;border-radius:50%;border:2px solid rgba(244,63,94,'+(0.35-r*0.1)+');animation:mcPulse 2.4s ease-out '+(r*0.8)+'s infinite';wrap.appendChild(ring);}}" +
"  var svg=document.createElementNS(ns,'svg');" +
"  svg.setAttribute('width','72');svg.setAttribute('height','72');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');" +
"  svg.style.cssText='position:relative;z-index:1';" +
"  svg.innerHTML='<defs><linearGradient id=\\'mco\\' x1=\\'0\\' y1=\\'0\\' x2=\\'1\\' y2=\\'1\\'><stop offset=\\'0\\' stop-color=\\'#f43f5e\\'/><stop offset=\\'1\\' stop-color=\\'#be123c\\'/></linearGradient></defs><circle cx=\\'12\\' cy=\\'12\\' r=\\'11\\' fill=\\'url(#mco)\\' opacity=\\'0.12\\'/><path d=\\'M8 13a4 4 0 0 1 7.5-2m-1.5 2a2 2 0 0 1 2.5 1.9\\' stroke=\\'url(#mco)\\' stroke-width=\\'1.6\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'/><path d=\\'M12 17.5v.01\\' stroke=\\'url(#mco)\\' stroke-width=\\'1.8\\' stroke-linecap=\\'round\\'/>';" +
"  wrap.appendChild(svg);" +
"  var t1=document.createElement('h1');t1.textContent='You\\'re offline';t1.style.cssText='margin:20px 0 8px;font-size:25px;font-weight:700;letter-spacing:-0.02em';" +
"  var t2=document.createElement('p');t2.textContent='Check your internet connection and try again. MalluCupid needs a connection to load creators, chats and content.';t2.style.cssText='margin:0 0 24px;font-size:14.5px;line-height:1.6;color:rgba(255,255,255,0.62)';" +
"  var btn=document.createElement('button');btn.type='button';btn.textContent='Try again';btn.style.cssText='appearance:none;-webkit-appearance:none;border:0;cursor:pointer;border-radius:999px;padding:15px 34px;font-size:15px;font-weight:600;color:#fff;background:linear-gradient(135deg,#f43f5e 0%,#be123c 100%);box-shadow:0 12px 28px rgba(244,63,94,0.45);transition:transform .14s ease,box-shadow .14s ease';" +
"  btn.onmouseenter=function(){btn.style.transform='translateY(-1px)';btn.style.boxShadow='0 16px 32px rgba(244,63,94,0.55)';};" +
"  btn.onmouseleave=function(){btn.style.transform='translateY(0)';btn.style.boxShadow='0 12px 28px rgba(244,63,94,0.45)';};" +
"  var ts=document.createElement('div');ts.style.cssText='margin-top:18px;font-size:11.5px;color:rgba(255,255,255,0.4);min-height:14px';" +
"  var wm=document.createElement('div');wm.textContent='MalluCupid';wm.style.cssText='margin-top:14px;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:rgba(244,63,94,0.7)';" +
"  card.appendChild(wrap);card.appendChild(t1);card.appendChild(t2);card.appendChild(btn);card.appendChild(ts);card.appendChild(wm);" +
"  ov.appendChild(card);" +
"  var st=document.createElement('style');" +
"  st.textContent='@keyframes mcFade{from{opacity:0}to{opacity:1}}@keyframes mcPop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes mcPulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.6);opacity:0}}';" +
"  if(!reduce){card.style.animation='mcPop .32s ease-out .04s both';}" +
"  var autoReloads=0,MAX_AUTO=3;" +
"  function fmtTs(){try{return 'Last checked '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});}catch(e){return '';}}" +
"  function ready(){document.body.appendChild(st);document.body.appendChild(ov);}" +
"  function sync(opts){opts=opts||{};var off=!navigator.onLine;ov.style.display=off?'flex':'none';if(off){ts.textContent=fmtTs();}if(!off&&opts.auto&&autoReloads<MAX_AUTO){autoReloads++;ts.textContent='Reconnecting...';setTimeout(function(){try{window.location.reload();}catch(e){}},450);}}" +
"  if(document.body){ready();sync();}else{document.addEventListener('DOMContentLoaded',function(){ready();sync();},false);}" +
"  window.addEventListener('online',function(){sync({auto:true});},false);" +
"  window.addEventListener('offline',function(){sync();},false);" +
"  document.addEventListener('visibilitychange',function(){if(!document.hidden){sync();}},false);" +
"  btn.onclick=function(){ts.textContent='Checking...';try{window.location.reload();}catch(e){}};" +
"})();";

    private static final String ERROR_SCREEN_JS =
"(function(){" +
"  if (window.__mcErrorScreenInjected) return; window.__mcErrorScreenInjected = true;" +
"  var ov=document.createElement('div');" +
"  ov.id='mc-error-screen';" +
"  ov.style.cssText='position:fixed;inset:0;z-index:2147483645;display:none;align-items:center;justify-content:center;padding:32px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:radial-gradient(120% 120% at 50% 0%,#1a1a22 0%,#0b0b0f 60%,#000 100%);color:#fff';" +
"  var card=document.createElement('div');" +
"  card.style.cssText='max-width:420px;width:100%;text-align:center;border-radius:28px;padding:44px 30px;background:rgba(255,255,255,0.04);border:1px solid rgba(244,63,94,0.22);box-shadow:0 28px 70px rgba(0,0,0,0.6)';" +
"  var icon=document.createElement('div');" +
"  icon.style.cssText='width:80px;height:80px;margin:0 auto 20px;border-radius:50%;background:linear-gradient(135deg,#f43f5e,#be123c);display:flex;align-items:center;justify-content:center;font-size:36px;color:#fff;box-shadow:0 12px 28px rgba(244,63,94,0.4)';" +
"  icon.textContent='!';" +
"  var t1=document.createElement('h1');t1.textContent='Something went wrong';t1.style.cssText='margin:0 0 8px;font-size:24px;font-weight:700;letter-spacing:-0.02em';" +
"  var t2=document.createElement('p');t2.textContent='The page failed to load. Check your connection and try again.';t2.style.cssText='margin:0 0 24px;font-size:14.5px;line-height:1.6;color:rgba(255,255,255,0.62)';" +
"  var btn=document.createElement('button');btn.type='button';btn.textContent='Reload';btn.style.cssText='appearance:none;-webkit-appearance:none;border:0;cursor:pointer;border-radius:999px;padding:15px 34px;font-size:15px;font-weight:600;color:#fff;background:linear-gradient(135deg,#f43f5e 0%,#be123c 100%);box-shadow:0 12px 28px rgba(244,63,94,0.45)';" +
"  btn.onclick=function(){try{window.location.reload();}catch(e){}};" +
"  var wm=document.createElement('div');wm.textContent='MalluCupid';wm.style.cssText='margin-top:18px;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:rgba(244,63,94,0.7)';" +
"  card.appendChild(icon);card.appendChild(t1);card.appendChild(t2);card.appendChild(btn);card.appendChild(wm);" +
"  ov.appendChild(card);" +
"  function check(){var bodyEmpty=!document.body||document.body.children.length===0||(document.body.textContent&&document.body.textContent.trim().length<10);ov.style.display=bodyEmpty?'flex':'none';}" +
"  function ready(){if(document.body){document.body.appendChild(ov);check();}}" +
"  if(document.body){ready();}else{document.addEventListener('DOMContentLoaded',function(){ready();},false);}" +
"  setTimeout(check,1500);" +
"})();";
}
