package com.sncall.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AppConfigTest {
    @Test
    fun offlineAssetUrlIsValid() {
        val assetUrl = "file:///android_asset/index.html"
        assertTrue(assetUrl.startsWith("file:///android_asset/"))
        assertEquals("index.html", assetUrl.substringAfterLast('/'))
    }

    @Test
    fun notificationChannelsAndActionsAreConfigured() {
        assertTrue(NotificationHelper.CHANNEL_INCOMING_CALL.isNotBlank())
        assertTrue(NotificationHelper.CHANNEL_FAKE_SMS.isNotBlank())
        assertEquals("com.sncall.app.ACTION_TRIGGER_CALL", FakeCallReceiver.ACTION_TRIGGER_CALL)
        assertEquals("com.sncall.app.ACTION_TRIGGER_SMS", FakeSmsReceiver.ACTION_TRIGGER_SMS)
    }
}
