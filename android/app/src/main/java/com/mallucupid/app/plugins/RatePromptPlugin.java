package com.mallucupid.app.plugins;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "McRatePrompt")
public class RatePromptPlugin extends Plugin {
    private static final String PREFS = "mc_rate_prompt";
    private static final String KEY_SESSIONS = "session_count";
    private static final String KEY_FIRST_LAUNCH_MS = "first_launch_ms";
    private static final String KEY_LAST_PROMPT_MS = "last_prompt_ms";
    private static final int MIN_SESSIONS = 3;
    private static final long MIN_DAYS = 2;
    private static final long MAX_DAYS_BETWEEN_PROMPTS = 120;

    @PluginMethod
    public void shouldPrompt(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long firstLaunch = prefs.getLong(KEY_FIRST_LAUNCH_MS, 0);
        if (firstLaunch == 0) { prefs.edit().putLong(KEY_FIRST_LAUNCH_MS, now).apply(); firstLaunch = now; }
        int sessions = prefs.getInt(KEY_SESSIONS, 0) + 1;
        prefs.edit().putInt(KEY_SESSIONS, sessions).apply();
        long lastPrompt = prefs.getLong(KEY_LAST_PROMPT_MS, 0);
        long daysSinceInstall = (now - firstLaunch) / (1000L * 60 * 60 * 24);
        long daysSinceLastPrompt = lastPrompt == 0 ? Long.MAX_VALUE : (now - lastPrompt) / (1000L * 60 * 60 * 24);
        boolean enoughSessions = sessions >= MIN_SESSIONS;
        boolean enoughDays = daysSinceInstall >= MIN_DAYS;
        boolean notRecentlyPrompted = daysSinceLastPrompt >= MAX_DAYS_BETWEEN_PROMPTS;
        boolean should = enoughSessions && enoughDays && notRecentlyPrompted;
        String reason = should ? "eligible" : !enoughSessions ? "need_more_sessions" : !enoughDays ? "too_soon_after_install" : "recently_prompted";
        JSObject ret = new JSObject();
        ret.put("shouldPrompt", should);
        ret.put("sessionCount", sessions);
        ret.put("daysSinceInstall", daysSinceInstall);
        ret.put("daysSinceLastPrompt", lastPrompt == 0 ? -1 : daysSinceLastPrompt);
        ret.put("reason", reason);
        call.resolve(ret);
    }

    @PluginMethod
    public void markPrompted(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putLong(KEY_LAST_PROMPT_MS, System.currentTimeMillis()).apply();
        JSObject ret = new JSObject(); ret.put("marked", true); call.resolve(ret);
    }

    @PluginMethod
    public void reset(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().clear().apply();
        JSObject ret = new JSObject(); ret.put("reset", true); call.resolve(ret);
    }
}
