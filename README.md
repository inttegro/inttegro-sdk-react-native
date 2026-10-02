# Inttegro React Native

[API reference](https://react-native.inttegro.dev/v0.3.0/) ·
[Studio guide](https://studio.inttegro.com/sdks/react-native)

Present native GHS checkout and collect Ghana Mobile Money payments through
Inttegro's typed React Native payment sheet. Card, Apple Pay, and Google Pay are
not exposed in this version.

```ts
import { addPaymentSheetEventListener } from '@inttegro/react-native/events';
import {
  initializePaymentSheet,
  presentPaymentSheet,
} from '@inttegro/react-native/payment-sheet';

// Your backend must create and finalize the Order before this handoff.
const { orderId } = await merchantBackend.createCheckoutOrder(cart);

const lifecycleSubscription = addPaymentSheetEventListener((event) => {
  switch (event.type) {
    case 'presented':
      onPaymentFlowStarted();
      break;
    case 'paymentAttemptStarted':
      onPaymentAttemptStarted();
      break;
    case 'paymentAttemptFailed':
      // Recoverable: the customer can retry without leaving the native sheet.
      onPaymentAttemptFailed({ category: event.errorType });
      break;
  }
});

await initializePaymentSheet({
  orderId,
  returnURL: 'merchant-app://inttegro-return',
  telemetry: activeTraceContext, // Optional { traceparent, tracestate }.
  features: {
    showLineItems: true,
    showInvoiceDownload: true,
    showReceiptDownload: true,
    allowPaymentMethodChange: false,
  },
});

try {
  const result = await presentPaymentSheet();

  switch (result.status) {
    case 'completed':
      onPaymentCompleted({ paymentId: result.paymentId });
      await merchantBackend.verifyOrderPayment(orderId);
      break;
    case 'canceled':
      onPaymentCanceled();
      break;
    case 'failed':
      onPaymentSheetFailed(result.error);
      break;
  }
} finally {
  lifecycleSubscription.remove();
}
```

The root import remains supported. Applications that prefer responsibility-based
modules can import the same APIs without pulling unrelated names into a file:

```ts
import {
  initializePaymentSheet,
  presentPaymentSheet,
} from '@inttegro/react-native/payment-sheet';
import { addPaymentSheetEventListener } from '@inttegro/react-native/events';
import {
  addPaymentSheetTelemetryListener,
} from '@inttegro/react-native/telemetry';
```

These are package entry points, not separate native implementations. They stay
on one version and delegate to the same iOS or Android state machine.

All feature flags are optional. Line items and post-payment downloads are off
by default; changing an attached payment method remains allowed by default.
When line items are enabled, the Order summary still starts collapsed. Opening
it expands the native sheet as the items are revealed.
Invoice and receipt actions appear only when Checkout returns the corresponding
document link after payment succeeds. Disabling payment-method changes does not
block collection when the Order has no attached method.

Finalizing an Order seals its amount and activates checkout; it does not mean
the payment has completed. Treat the immediate `completed` result as client UI
state. Verify the owner-scoped Order from your backend before fulfillment.

The TurboModule exchanges versioned JSON with the native iOS and Android
artifacts. The native implementations own presentation, accessibility,
authentication, payment collection, and lifecycle state; JavaScript only
validates the public input and decodes the result.

`addPaymentSheetEventListener` receives typed application-facing lifecycle
events. A failed attempt is recoverable and does not resolve the presentation;
the terminal `PaymentSheetResult` drives completion, cancellation, and
sheet-failure behavior.

Use `addPaymentSheetTelemetryListener` separately for ordered Checkout network
diagnostics. Inttegro does not install or own an exporter: the host decides
whether to translate them into spans, logs, or other signals. Events contain
bounded status and correlation metadata, never Order or Payment IDs, customer
or payer data, payment-method details, request or response bodies, redirect
URLs, or raw error messages. `flowId` and `requestId` should not be used as
metric labels. Subscribe before presenting the sheet so the first event is not
missed.

The package includes a Codegen-compatible TurboModule that delegates to the
same native `Inttegro` artifacts used by the Flutter SDK. CocoaPods links the
iOS artifact through `InttegroReactNative.podspec`, while Gradle resolves
`com.inttegro:inttegro-android:0.2.0`.

## Requirements

- React Native 0.82 or later with the New Architecture enabled
- iOS 16 or later
- Android API 26 or later

Install the package and rebuild the native application so Codegen and native
autolinking can run. Expo applications need a development build; Expo Go cannot
load this native module. If the app has not been rebuilt, calling the facade
produces a linking error without preventing the host app from starting.
