# Observe the native payment flow

Connect Inttegro's privacy-safe native diagnostics to telemetry owned by the
React Native application.

```ts
import { addPaymentSheetTelemetryListener } from '@inttegro/react-native/telemetry';

const diagnostics = addPaymentSheetTelemetryListener((event) => {
  recorder.record({
    name: event.name,
    flowId: event.flowId,
    sequence: event.sequence,
    operation: event.operation,
    statusCode: event.httpStatusCode,
    requestId: event.requestId,
    retryAfterSeconds: event.retryAfterSeconds,
    errorType: event.errorType,
  });
});
```

Inttegro installs no exporter. The stream covers native presentation, Checkout
retrieval, payment attempts, confirmation, authorization waits, polling,
terminal state, and public Checkout transport activity.

When an idempotent mutation receives `503` with a valid `Retry-After` header,
the native transport waits and retries once with the same idempotency key. The
response event records that bounded delay. If the second attempt fails, the
terminal error can carry the same `requestId` and `retryAfterSeconds` values.

Events exclude Order and Payment IDs, customer and payer fields, payment-method
details, billing and shipping addresses, request and response bodies, redirect
URLs, and raw error messages. Preserve this boundary when mapping events into
logs or spans. Treat flow and request IDs as correlation values rather than
high-cardinality metric dimensions.

Supply a valid W3C `traceparent` and optional `tracestate` through the payment
sheet configuration. The native Checkout transport propagates them only while
telemetry is enabled. Set `enabled` to `false` to disable both diagnostics and
trace-header propagation, and remove the subscription when the host screen
unmounts.
