package com.sncall.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

object CallAlarmScheduler {
    private const val PREFS_NAME = "sn_call_native_prefs"
    private const val KEY_PENDING_RECENTS = "pending_recents"
    private const val KEY_RINGTONE_NAME = "custom_ringtone_name"
    private const val REQ_CODE_CALL = 4001
    private const val REQ_CODE_SMS = 4002

    fun scheduleFakeCall(
        context: Context,
        name: String,
        number: String,
        sim: String,
        avatarColor: String,
        delaySeconds: Int
    ) {
        cancelFakeCall(context)
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerAtMillis = System.currentTimeMillis() + (delaySeconds.coerceAtLeast(1) * 1000L)

        val receiverIntent = Intent(context, FakeCallReceiver::class.java).apply {
            action = FakeCallReceiver.ACTION_TRIGGER_CALL
            putExtra(FakeCallReceiver.EXTRA_NAME, name)
            putExtra(FakeCallReceiver.EXTRA_NUMBER, number)
            putExtra(FakeCallReceiver.EXTRA_SIM, sim)
            putExtra(FakeCallReceiver.EXTRA_COLOR, avatarColor)
        }
        val operation = PendingIntent.getBroadcast(
            context,
            REQ_CODE_CALL,
            receiverIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        scheduleExactSafe(context, alarmManager, triggerAtMillis, operation)
    }

    fun cancelFakeCall(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, FakeCallReceiver::class.java).apply {
            action = FakeCallReceiver.ACTION_TRIGGER_CALL
        }
        val pending = PendingIntent.getBroadcast(
            context,
            REQ_CODE_CALL,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pending)
    }

    fun scheduleFakeSms(
        context: Context,
        sender: String,
        message: String,
        delaySeconds: Int
    ) {
        cancelFakeSms(context)
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerAtMillis = System.currentTimeMillis() + (delaySeconds.coerceAtLeast(1) * 1000L)

        val receiverIntent = Intent(context, FakeSmsReceiver::class.java).apply {
            action = FakeSmsReceiver.ACTION_TRIGGER_SMS
            putExtra(FakeSmsReceiver.EXTRA_SENDER, sender)
            putExtra(FakeSmsReceiver.EXTRA_MESSAGE, message)
        }
        val operation = PendingIntent.getBroadcast(
            context,
            REQ_CODE_SMS,
            receiverIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        scheduleExactSafe(context, alarmManager, triggerAtMillis, operation)
    }

    fun cancelFakeSms(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, FakeSmsReceiver::class.java).apply {
            action = FakeSmsReceiver.ACTION_TRIGGER_SMS
        }
        val pending = PendingIntent.getBroadcast(
            context,
            REQ_CODE_SMS,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pending)
    }

    private fun scheduleExactSafe(
        context: Context,
        alarmManager: AlarmManager,
        triggerAtMillis: Long,
        operation: PendingIntent
    ) {
        val canExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }

        if (canExact) {
            try {
                // setAlarmClock wakes device reliably even during deep Doze / locked screen
                val showIntent = PendingIntent.getActivity(
                    context,
                    4009,
                    Intent(context, MainActivity::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                val alarmInfo = AlarmManager.AlarmClockInfo(triggerAtMillis, showIntent)
                alarmManager.setAlarmClock(alarmInfo, operation)
                return
            } catch (_: SecurityException) {
                // Fall back to inexact while-idle below
            }
        }

        try {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, operation)
        } catch (_: Exception) {
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, operation)
        }
    }

    fun getCustomRingtoneFile(context: Context): File {
        return File(context.filesDir, "custom_ringtone.audio")
    }

    fun clearCustomRingtone(context: Context) {
        val f = getCustomRingtoneFile(context)
        if (f.exists()) f.delete()
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_RINGTONE_NAME)
            .apply()
    }

    fun saveCustomRingtoneName(context: Context, displayName: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_RINGTONE_NAME, displayName)
            .apply()
    }

    fun getCustomRingtoneName(context: Context): String {
        val f = getCustomRingtoneFile(context)
        if (!f.exists() || f.length() == 0L) return ""
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_RINGTONE_NAME, "") ?: ""
    }

    fun addPendingRecent(
        context: Context,
        name: String,
        number: String,
        sim: String,
        avatarColor: String,
        status: String,
        durationSec: Int
    ) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val arr = try {
            JSONArray(prefs.getString(KEY_PENDING_RECENTS, "[]"))
        } catch (_: Exception) {
            JSONArray()
        }
        val item = JSONObject().apply {
            put("id", "nat-${System.currentTimeMillis()}")
            put("name", name)
            put("number", number)
            put("sim", sim)
            put("timestamp", System.currentTimeMillis())
            put("status", status)
            put("durationSec", durationSec)
            put("avatarColor", avatarColor)
        }
        arr.put(item)
        prefs.edit().putString(KEY_PENDING_RECENTS, arr.toString()).apply()
    }

    fun consumePendingRecents(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_PENDING_RECENTS, "[]") ?: "[]"
        prefs.edit().remove(KEY_PENDING_RECENTS).apply()
        return raw
    }
}
