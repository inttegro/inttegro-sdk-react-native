package com.inttegro.reactnative

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.inttegro.payments.PaymentSheetException
import com.inttegro.payments.PaymentSheetLauncher

class InttegroModule(
    reactContext: ReactApplicationContext,
) : NativeInttegroSpec(reactContext), ActivityEventListener {
    private var configurationJson: String? = null
    private var presentationPromise: Promise? = null
    private var launchIntent: Intent? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun initializePaymentSheet(configurationJson: String, promise: Promise) {
        if (presentationPromise != null) {
            promise.reject(
                "payment_sheet_already_presented",
                "The payment sheet is already presented.",
            )
            return
        }
        try {
            PaymentSheetLauncher.validateConfiguration(configurationJson)
            this.configurationJson = configurationJson
            promise.resolve(null)
        } catch (error: PaymentSheetException) {
            promise.reject(error.code, error.message, error)
        } catch (error: Exception) {
            promise.reject(
                "invalid_configuration",
                error.message ?: "The payment sheet configuration is invalid.",
                error,
            )
        }
    }

    override fun presentPaymentSheet(promise: Promise) {
        if (presentationPromise != null) {
            promise.reject(
                "payment_sheet_already_presented",
                "The payment sheet is already presented.",
            )
            return
        }
        val payload = configurationJson
        if (payload == null) {
            promise.reject(
                "payment_sheet_not_initialized",
                "Initialize the payment sheet before presenting it.",
            )
            return
        }

        UiThreadUtil.runOnUiThread {
            val activity = currentActivity
            if (activity == null) {
                promise.reject(
                    "presentation_unavailable",
                    "The payment sheet needs an active React Native screen.",
                )
                return@runOnUiThread
            }

            try {
                presentationPromise = promise
                val intent = PaymentSheetLauncher.createIntent(
                    activity,
                    payload,
                    { event ->
                        UiThreadUtil.runOnUiThread {
                            emitOnPaymentSheetEvent(event)
                        }
                    },
                    { event ->
                        UiThreadUtil.runOnUiThread {
                            emitOnPaymentSheetTelemetryEvent(event)
                        }
                    },
                )
                launchIntent = intent
                activity.startActivityForResult(intent, REQUEST_CODE)
            } catch (error: Exception) {
                presentationPromise = null
                PaymentSheetLauncher.release(launchIntent)
                launchIntent = null
                promise.reject(
                    "presentation_unavailable",
                    error.message ?: "The payment sheet could not be presented.",
                    error,
                )
            }
        }
    }

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
    ) {
        if (requestCode != REQUEST_CODE) return
        val promise = presentationPromise ?: return
        presentationPromise = null
        PaymentSheetLauncher.release(launchIntent)
        launchIntent = null
        val result = PaymentSheetLauncher.resultFrom(data)
        if (result == null) {
            promise.reject(
                "invalid_native_result",
                "The native payment sheet returned no result.",
            )
            return
        }
        promise.resolve(result)
    }

    override fun onNewIntent(intent: Intent) = Unit

    companion object {
        const val NAME = "Inttegro"
        private const val REQUEST_CODE = 18_270
    }
}
