package com.mallucupid.app.plugins;

import android.graphics.Color;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.widget.LinearLayoutCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "McToast")
public class ToastPlugin extends Plugin {

    @PluginMethod
    public void show(PluginCall call) {
        String message = call.getString("message", "");
        if (message.isEmpty()) { call.reject("message is required"); return; }
        String style = call.getString("style", "info");
        int duration = call.getInt("duration", 0);
        int toastDuration = (duration == 1) ? Toast.LENGTH_LONG : Toast.LENGTH_SHORT;

        int bgColor, accentColor, textColor;
        switch (style) {
            case "success": bgColor = Color.parseColor("#0F1A14"); accentColor = Color.parseColor("#10B981"); textColor = Color.parseColor("#ECFDF5"); break;
            case "error":   bgColor = Color.parseColor("#1F1012"); accentColor = Color.parseColor("#F43F5E"); textColor = Color.parseColor("#FFF1F2"); break;
            case "warning": bgColor = Color.parseColor("#1F1A0F"); accentColor = Color.parseColor("#F59E0B"); textColor = Color.parseColor("#FFFBEB"); break;
            default:        bgColor = Color.parseColor("#0B0B0F"); accentColor = Color.parseColor("#F43F5E"); textColor = Color.parseColor("#FFFFFF"); break;
        }

        final String msg = message;
        final int fBg = bgColor, fAccent = accentColor, fText = textColor;
        final int fDur = toastDuration;

        getActivity().runOnUiThread(() -> {
            try {
                Toast toast = new Toast(getContext());
                LinearLayout container = new LinearLayout(getContext());
                container.setOrientation(LinearLayout.HORIZONTAL);
                int pad = dp(16);
                container.setPadding(pad + dp(8), dp(11), pad, dp(11));
                container.setGravity(Gravity.CENTER_VERTICAL);
                android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
                bg.setColor(fBg);
                bg.setCornerRadius(dp(24));
                bg.setStroke(dp(1), (fAccent & 0x00FFFFFF) | (0x55 << 24));
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) container.setElevation(dp(8));
                container.setBackground(bg);
                View dot = new View(getContext());
                LinearLayoutCompat.LayoutParams dotLp = new LinearLayoutCompat.LayoutParams(dp(8), dp(8));
                dotLp.setMarginEnd(dp(10));
                dot.setLayoutParams(dotLp);
                android.graphics.drawable.GradientDrawable dotBg = new android.graphics.drawable.GradientDrawable();
                dotBg.setColor(fAccent);
                dotBg.setShape(android.graphics.drawable.GradientDrawable.OVAL);
                dot.setBackground(dotBg);
                container.addView(dot);
                TextView tv = new TextView(getContext());
                tv.setText(msg); tv.setTextColor(fText); tv.setTextSize(14); tv.setMaxWidth(dp(320));
                container.addView(tv);
                toast.setView(container);
                toast.setDuration(fDur);
                toast.setGravity(Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL, 0, dp(72));
                toast.show();
            } catch (Exception e) {
                Toast.makeText(getContext(), msg, fDur).show();
            }
        });
        JSObject ret = new JSObject();
        ret.put("shown", true);
        call.resolve(ret);
    }

    private int dp(int v) { return (int) (v * getContext().getResources().getDisplayMetrics().density + 0.5f); }
}
