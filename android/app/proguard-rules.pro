# Keep WebView JavaScript interfaces and app classes intact
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
