# MalluCupid ProGuard / R8 rules
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitorjs.plugins.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
-keep class com.mallucupid.app.plugins.** { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.PluginMethod <methods>;
    @com.getcapacitor.annotation.CapacitorPlugin *;
}
-keepclassmembers class com.getcapacitor.* { public *; }
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes RuntimeVisibleAnnotations
-keepattributes RuntimeInvisibleAnnotations
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
-keepclasseswithmembernames class * { native <methods>; }
-keep class com.mallucupid.app.MainActivity { *; }
-dontwarn com.getcapacitor.**
-dontwarn com.capacitorjs.plugins.**
-dontwarn com.razorpay.**
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
