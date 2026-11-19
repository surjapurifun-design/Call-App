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
}
