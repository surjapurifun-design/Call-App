package com.sncall.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat

object NotificationHelper {
    const val CHANNEL_INCOMING_CALL = "sn_call_incoming_v2"
    const val CHANNEL_FAKE_SMS = "sn_call_sms_v2"
    const val NOTIF_ID_CALL = 1001
    const val NOTIF_ID_SMS_BASE = 2000

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        val callAudioAttrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val callChannel = NotificationChannel(
            CHANNEL_INCOMING_CALL,
            "Incoming Calls",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Full-screen incoming fake calls over lock screen and other apps"
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 500, 300, 500, 900)
            setSound(ringtoneUri, callAudioAttrs)
            setBypassDnd(true)
        }
        manager.createNotificationChannel(callChannel)

        val smsUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val smsAudioAttrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val smsChannel = NotificationChannel(
            CHANNEL_FAKE_SMS,
            "Messages",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Heads-up fake SMS notifications"
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 120, 80, 140)
            setSound(smsUri, smsAudioAttrs)
        }
        manager.createNotificationChannel(smsChannel)
    }

    fun showIncomingCallNotification(
        context: Context,
        name: String,
        number: String,
        sim: String,
        avatarColor: String
    ) {
        ensureChannels(context)

        val fullScreenIntent = IncomingCallActivity.createIntent(
            context = context,
            name = name,
            number = number,
            sim = sim,
            avatarColor = avatarColor,
            autoAnswer = false
        )
        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            101,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val answerIntent = IncomingCallActivity.createIntent(
            context = context,
            name = name,
            number = number,
            sim = sim,
            avatarColor = avatarColor,
            autoAnswer = true
        )
        val answerPendingIntent = PendingIntent.getActivity(
            context,
            102,
            answerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val declineIntent = Intent(context, FakeCallReceiver::class.java).apply {
            action = FakeCallReceiver.ACTION_DECLINE_CALL
            putExtra(FakeCallReceiver.EXTRA_NAME, name)
            putExtra(FakeCallReceiver.EXTRA_NUMBER, number)
            putExtra(FakeCallReceiver.EXTRA_SIM, sim)
            putExtra(FakeCallReceiver.EXTRA_COLOR, avatarColor)
        }
        val declinePendingIntent = PendingIntent.getBroadcast(
            context,
            103,
            declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_INCOMING_CALL)
            .setSmallIcon(R.drawable.ic_launcher_vector)
            .setContentTitle(name)
            .setContentText("Incoming call • $sim • $number")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(true)
            .setContentIntent(fullScreenPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .addAction(0, "Decline", declinePendingIntent)
            .addAction(0, "Answer", answerPendingIntent)
            .build()

        notification.flags = notification.flags or Notification.FLAG_INSISTENT

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIF_ID_CALL, notification)
    }

    fun cancelIncomingCallNotification(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(NOTIF_ID_CALL)
    }

    fun showFakeSmsNotification(context: Context, sender: String, message: String) {
        ensureChannels(context)

        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            context,
            201,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_FAKE_SMS)
            .setSmallIcon(R.drawable.ic_launcher_vector)
            .setContentTitle(sender)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(contentPendingIntent)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val id = NOTIF_ID_SMS_BASE + ((System.currentTimeMillis() % 900).toInt())
        manager.notify(id, notification)
    }
}
