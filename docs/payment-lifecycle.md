# Handle the payment lifecycle

Use lifecycle events for host coordination, terminal results for presentation
behavior, and the backend Order for fulfillment authority.

## Subscribe before presentation

```ts
import { addPaymentSheetEventListener } from '@inttegro/react-native/events';
import { presentPaymentSheet } from '@inttegro/react-native/payment-sheet';

const subscription = addPaymentSheetEventListener((event) => {
  switch (event.type) {
    case 'presented':
      checkoutAnalytics.started();
      break;
    case 'paymentAttemptFailed':
      checkoutAnalytics.retryAvailable({ category: event.errorType });
      break;
    case 'authorizationRequired':
      showReturnToPaymentHint();
      break;
  }
});

try {
  await presentPaymentSheet();
} finally {
  subscription.remove();
}
```

Subscribe before presentation so the first event is not missed. Sequence values
increase within a flow and preserve ordering when the host batches analytics
work.

## Separate recoverable and terminal state

Checkout retrieval and payment-attempt failures can be recoverable. The native
sheet displays safe guidance and gives the payer another attempt without
resolving `presentPaymentSheet`.

Confirmation-code entry, provider redirects, device authorization, and Checkout
status polling are also native intermediate states. Terminal results are limited
to completion, customer cancellation, and an unrecoverable SDK failure.
Terminal failures may include `error.requestId` for support correlation and
`error.retryAfterSeconds` when the server directs the next retry window.

## Reconcile on the backend

Send the Order ID to the merchant backend after client completion. Retrieve the
owner-scoped Order with server credentials, verify the expected amount and
successful payment state, and make fulfillment idempotent. Webhooks may update
the same backend state for delayed methods; React Native should render that
server-owned result instead of resolving competing client and webhook timelines.
