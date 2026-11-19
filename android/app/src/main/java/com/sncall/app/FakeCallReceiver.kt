package com.sncall.app

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

class FakeCallReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val name = intent.getStringExtra(EXTRA_NAME) ?: "Unknown Caller"
        val number = intent.getStringExtra(EXTRA_NUMBER) ?: "+91 98765 43210"
        val sim = intent.getStringExtra(EXTRA_SIM) ?: "SIM 1"
        val color = intent.getStringExtra(EXTRA_COLOR) ?: "#1A73E8"

        if (intent.action == ACTION_DECLINE_CALL) {
            NotificationHelper.cancelIncomingCallNotification(context)
            CallAlarmScheduler.addPendingRecent(
                context = context,
                name = name,
                number = number,
                sim = sim,
                avatarColor = color,
                status = "declined",
                durationSec = 0
            )
            return
        }

        // Wake CPU briefly so full-screen incoming call launches cleanly even when locked
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "SnCall:IncomingCallWakeLock"
        )
        try {
            wakeLock.acquire(10_000L)
        } catch (_: Exception) {
            // Ignore wake lock failures
        }

        // Always post high-priority full-screen call notification (wakes lock screen & shows over other apps)
        NotificationHelper.showIncomingCallNotification(
            context = context,
            name = name,
            number = number,
            sim = sim,
            avatarColor = color
        )

        // If device is locked OR overlay permission is granted, launch full-screen IncomingCallActivity directly
        val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val isLocked = keyguard.isKeyguardLocked || !powerManager.isInteractive
        val canOverlay = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)

        if (isLocked || canOverlay) {
            val activityIntent = IncomingCallActivity.createIntent(
                context = context,
                name = name,
                number = number,
                sim = sim,
                avatarColor = color,
                autoAnswer = false
            )
            try {
                context.startActivity(activityIntent)
            } catch (_: Exception) {
                // Full-screen notification intent above handles launch fallback cleanly
            }
        }
    }

    companion object {
        const val ACTION_TRIGGER_CALL = "com.sncall.app.ACTION_TRIGGER_CALL"
        const val ACTION_DECLINE_CALL = "com.sncall.app.ACTION_DECLINE_CALL"
        const val EXTRA_NAME = "extra_name"
        const val EXTRA_NUMBER = "extra_number"
        const val EXTRA_SIM = "extra_sim"
        const val EXTRA_COLOR = "extra_color"
    }
}
