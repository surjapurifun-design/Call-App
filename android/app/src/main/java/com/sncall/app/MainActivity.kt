package com.sncall.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.provider.Settings
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import org.json.JSONObject
import java.io.FileOutputStream

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) {
        notifyWebResume()
    }

    private val audioFilePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = filePathCallback
        filePathCallback = null
        if (callback == null) return@registerForActivityResult

        val dataUri = if (result.resultCode == Activity.RESULT_OK) result.data?.data else null
        if (dataUri != null) {
            copyCustomRingtoneLocally(dataUri)
            callback.onReceiveValue(arrayOf(dataUri))
        } else {
            callback.onReceiveValue(null)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        NotificationHelper.ensureChannels(this)
        requestNotificationPermissionIfNeeded()

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.statusBarColor = Color.parseColor("#F8F9FA")
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = true

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#F8F9FA"))
            overScrollMode = WebView.OVER_SCROLL_NEVER
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                mediaPlaybackRequiresUserGesture = false
                cacheMode = WebSettings.LOAD_NO_CACHE
                builtInZoomControls = false
                displayZoomControls = false
                setSupportZoom(false)
            }

            addJavascriptInterface(NativeBridge(), "SnCallNative")

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val uri = request?.url ?: return false
                    return uri.scheme != "file"
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    notifyWebResume()
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = filePathCallback

                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "audio/*"
                    }
                    return try {
                        audioFilePickerLauncher.launch(intent)
                        true
                    } catch (_: Exception) {
                        this@MainActivity.filePathCallback?.onReceiveValue(null)
                        this@MainActivity.filePathCallback = null
                        false
                    }
                }
            }
        }

        setContentView(webView)
        webView.loadUrl("file:///android_asset/index.html")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    override fun onResume() {
        super.onResume()
        notifyWebResume()
    }

    private fun notifyWebResume() {
        if (::webView.isInitialized) {
            webView.post {
                webView.evaluateJavascript("if(window.onSnCallNativeResume){window.onSnCallNativeResume();}", null)
            }
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun copyCustomRingtoneLocally(uri: Uri) {
        try {
            val outFile = CallAlarmScheduler.getCustomRingtoneFile(this)
            contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(outFile).use { output ->
                    input.copyTo(output)
                }
            }
            val displayName = resolveDisplayName(uri) ?: "Custom Ringtone"
            CallAlarmScheduler.saveCustomRingtoneName(this, displayName)
        } catch (_: Exception) {
            // Fallback gracefully to default Android ringtone when locked
        }
    }

    private fun resolveDisplayName(uri: Uri): String? {
        var cursor: Cursor? = null
        return try {
            cursor = contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            if (cursor != null && cursor.moveToFirst()) {
                val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (idx >= 0) cursor.getString(idx) else null
            } else {
                null
            }
        } catch (_: Exception) {
            null
        } finally {
            cursor?.close()
        }
    }

    override fun onDestroy() {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        webView.destroy()
        super.onDestroy()
    }

    private inner class NativeBridge {
        @JavascriptInterface
        fun isNativeApp(): Boolean = true

        @JavascriptInterface
        fun scheduleCall(
            name: String,
            number: String,
            sim: String,
            avatarColor: String,
            delaySeconds: Int
        ) {
            if (delaySeconds <= 0) {
                runOnUiThread {
                    val intent = IncomingCallActivity.createIntent(
                        context = this@MainActivity,
                        name = name,
                        number = number,
                        sim = sim,
                        avatarColor = avatarColor,
                        autoAnswer = false
                    )
                    startActivity(intent)
                }
            } else {
                CallAlarmScheduler.scheduleFakeCall(
                    context = this@MainActivity,
                    name = name,
                    number = number,
                    sim = sim,
                    avatarColor = avatarColor,
                    delaySeconds = delaySeconds
                )
            }
        }

        @JavascriptInterface
        fun cancelScheduledCall() {
            CallAlarmScheduler.cancelFakeCall(this@MainActivity)
        }

        @JavascriptInterface
        fun scheduleSms(sender: String, message: String, delaySeconds: Int) {
            if (delaySeconds <= 0) {
                NotificationHelper.showFakeSmsNotification(this@MainActivity, sender, message)
            } else {
                CallAlarmScheduler.scheduleFakeSms(
                    context = this@MainActivity,
                    sender = sender,
                    message = message,
                    delaySeconds = delaySeconds
                )
            }
        }

        @JavascriptInterface
        fun cancelScheduledSms() {
            CallAlarmScheduler.cancelFakeSms(this@MainActivity)
        }

        @JavascriptInterface
        fun clearCustomRingtone() {
            CallAlarmScheduler.clearCustomRingtone(this@MainActivity)
        }

        @JavascriptInterface
        fun getSavedRingtoneName(): String {
            return CallAlarmScheduler.getCustomRingtoneName(this@MainActivity)
        }

        @JavascriptInterface
        fun consumePendingRecents(): String {
            return CallAlarmScheduler.consumePendingRecents(this@MainActivity)
        }

        @JavascriptInterface
        fun getPermissionStatus(): String {
            val notifGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }

            val overlayGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(this@MainActivity)
            } else {
                true
            }

            val fullScreenGranted = if (Build.VERSION.SDK_INT >= 34) {
                val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.canUseFullScreenIntent()
            } else {
                true
            }

            val exactAlarmGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
                am.canScheduleExactAlarms()
            } else {
                true
            }

            return JSONObject().apply {
                put("notifications", notifGranted)
                put("overlay", overlayGranted)
                put("fullScreen", fullScreenGranted)
                put("exactAlarm", exactAlarmGranted)
            }.toString()
        }

        @JavascriptInterface
        fun requestNotificationPermission() {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    val granted = ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        Manifest.permission.POST_NOTIFICATIONS
                    ) == PackageManager.PERMISSION_GRANTED
                    if (!granted) {
                        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        return@runOnUiThread
                    }
                }
                val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                        putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
                    }
                } else {
                    Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:$packageName")
                    )
                }
                try {
                    startActivity(intent)
                } catch (_: Exception) {
                    // Ignore
                }
            }
        }

        @JavascriptInterface
        fun openOverlayPermission() {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                    try {
                        startActivity(intent)
                    } catch (_: Exception) {
                        // Ignore
                    }
                }
            }
        }

        @JavascriptInterface
        fun openFullScreenPermission() {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= 34) {
                    val intent = Intent(
                        "android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT",
                        Uri.parse("package:$packageName")
                    )
                    try {
                        startActivity(intent)
                    } catch (_: Exception) {
                        // Fallback to app details
                    }
                }
            }
        }

        @JavascriptInterface
        fun openExactAlarmPermission() {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val intent = Intent(
                        Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                        Uri.parse("package:$packageName")
                    )
                    try {
                        startActivity(intent)
                    } catch (_: Exception) {
                        // Ignore
                    }
                }
            }
        }
    }
}
