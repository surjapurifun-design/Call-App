package com.sncall.app

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat

class IncomingCallActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var callerName: String = "Unknown Caller"
    private var callerNumber: String = "+91 98765 43210"
    private var callerSim: String = "SIM 1"
    private var callerColor: String = "#1A73E8"
    private var callLogged: Boolean = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Allow activity to wake up the phone and appear directly over the Lock Screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.statusBarColor = Color.parseColor("#0F1F2E")
        window.navigationBarColor = Color.parseColor("#091118")
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = false

        // Dismiss the notification once fullscreen screen opens so audio does not overlap
        NotificationHelper.cancelIncomingCallNotification(this)

        callerName = intent.getStringExtra(FakeCallReceiver.EXTRA_NAME) ?: "Unknown Caller"
        callerNumber = intent.getStringExtra(FakeCallReceiver.EXTRA_NUMBER) ?: "+91 98765 43210"
        callerSim = intent.getStringExtra(FakeCallReceiver.EXTRA_SIM) ?: "SIM 1"
        callerColor = intent.getStringExtra(FakeCallReceiver.EXTRA_COLOR) ?: "#1A73E8"
        val autoAnswer = intent.getBooleanExtra(EXTRA_AUTO_ANSWER, false)

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#091118"))
            overScrollMode = WebView.OVER_SCROLL_NEVER
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                cacheMode = WebSettings.LOAD_NO_CACHE
            }
            addJavascriptInterface(CallBridge(), "SnCallNative")
            webViewClient = WebViewClient()
        }

        setContentView(webView)

        val url = Uri.Builder()
            .scheme("file")
            .authority("")
            .path("/android_asset/index.html")
            .appendQueryParameter("nativeCall", "1")
            .appendQueryParameter("name", callerName)
            .appendQueryParameter("number", callerNumber)
            .appendQueryParameter("sim", callerSim)
            .appendQueryParameter("color", callerColor)
            .appendQueryParameter("autoAnswer", if (autoAnswer) "1" else "0")
            .build()
            .toString()

        webView.loadUrl(url)

        if (!autoAnswer) {
            startNativeRingtoneAndVibration()
        }

        // Prevent accidental back press from dismissing an active call silently
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // User must tap Answer, Decline, or End Call just like a real phone call
            }
        })
    }

    private fun startNativeRingtoneAndVibration() {
        stopNativeRingtoneAndVibration()

        // Play custom saved MP3 if available, otherwise play the phone's real default ringtone
        val customFile = CallAlarmScheduler.getCustomRingtoneFile(this)
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        try {
            val player = MediaPlayer()
            player.setAudioAttributes(attrs)
            if (customFile.exists() && customFile.length() > 0L) {
                player.setDataSource(customFile.absolutePath)
            } else {
                val defaultUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                player.setDataSource(this, defaultUri)
            }
            player.isLooping = true
            player.prepare()
            player.start()
            mediaPlayer = player
        } catch (_: Exception) {
            // If native ringtone fails on an emulator/silent device, keep UI active cleanly
        }

        try {
            val vib = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            vibrator = vib
            val pattern = longArrayOf(0, 500, 300, 500, 900)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vib.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vib.vibrate(pattern, 0)
            }
        } catch (_: Exception) {
            // Ignore vibration failures
        }
    }

    private fun stopNativeRingtoneAndVibration() {
        try {
            mediaPlayer?.let {
                if (it.isPlaying) it.stop()
                it.reset()
                it.release()
            }
        } catch (_: Exception) {
            // Ignore cleanup errors
        }
        mediaPlayer = null

        try {
            vibrator?.cancel()
        } catch (_: Exception) {
            // Ignore cleanup errors
        }
        vibrator = null
    }

    override fun onDestroy() {
        stopNativeRingtoneAndVibration()
        NotificationHelper.cancelIncomingCallNotification(this)
        webView.destroy()
        super.onDestroy()
    }

    private inner class CallBridge {
        @JavascriptInterface
        fun isNativeCallScreen(): Boolean = true

        @JavascriptInterface
        fun onNativeCallAnswered() {
            runOnUiThread {
                stopNativeRingtoneAndVibration()
                NotificationHelper.cancelIncomingCallNotification(this@IncomingCallActivity)
            }
        }

        @JavascriptInterface
        fun onNativeCallEnded(status: String, durationSec: Int) {
            runOnUiThread {
                stopNativeRingtoneAndVibration()
                NotificationHelper.cancelIncomingCallNotification(this@IncomingCallActivity)
                if (!callLogged) {
                    callLogged = true
                    CallAlarmScheduler.addPendingRecent(
                        context = this@IncomingCallActivity,
                        name = callerName,
                        number = callerNumber,
                        sim = callerSim,
                        avatarColor = callerColor,
                        status = status,
                        durationSec = durationSec
                    )
                }
                finish()
            }
        }
    }

    companion object {
        private const val EXTRA_AUTO_ANSWER = "extra_auto_answer"

        fun createIntent(
            context: Context,
            name: String,
            number: String,
            sim: String,
            avatarColor: String,
            autoAnswer: Boolean
        ): Intent {
            return Intent(context, IncomingCallActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra(FakeCallReceiver.EXTRA_NAME, name)
                putExtra(FakeCallReceiver.EXTRA_NUMBER, number)
                putExtra(FakeCallReceiver.EXTRA_SIM, sim)
                putExtra(FakeCallReceiver.EXTRA_COLOR, avatarColor)
                putExtra(EXTRA_AUTO_ANSWER, autoAnswer)
            }
        }
    }
}
