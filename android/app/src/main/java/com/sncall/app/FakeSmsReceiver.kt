package com.sncall.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class FakeSmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val sender = intent.getStringExtra(EXTRA_SENDER) ?: "Messages"
        val message = intent.getStringExtra(EXTRA_MESSAGE) ?: "New message received."
        NotificationHelper.showFakeSmsNotification(context, sender, message)
    }

    companion object {
        const val ACTION_TRIGGER_SMS = "com.sncall.app.ACTION_TRIGGER_SMS"
        const val EXTRA_SENDER = "extra_sender"
        const val EXTRA_MESSAGE = "extra_message"
    }
}
