# Get started with Checkout

Create and finalize an Order on your backend, hand its public ID to React
Native, and present Inttegro's native payment sheet.

## Choose an entry point

Use responsibility-based imports for new integrations:

```ts
import {
  initializePaymentSheet,
  presentPaymentSheet,
} from '@inttegro/react-native/payment-sheet';
import type { PaymentSheetConfiguration } from '@inttegro/react-native/types';
```

The root `@inttegro/react-native` import remains supported. Focused entry points
organize the generated reference and application imports; they delegate to the
same native module and do not create competing payment implementations.

## Create configuration

Your backend owns merchant authentication and Order creation. The application
supplies only the public Order ID and client-owned presentation options.
Merchant identity, amount, currency, line items, saved methods, and shipping
details come from Checkout.

```ts
const configuration: PaymentSheetConfiguration = {
  orderId: checkout.orderId,
  returnURL: 'merchant-app://inttegro-return',
  appearance: { primaryColor: '#0C4A3E' },
  features: {
    showLineItems: true,
    showInvoiceDownload: true,
    showReceiptDownload: true,
  },
};

await initializePaymentSheet(configuration);
```

Initialization validates the bridge payload without retrieving Checkout or
starting payment. Call it again when the Order ID or presentation options
change. Never place an Inttegro merchant API key in a mobile application.

### Start from a Buy link

If your backend returns a Buy link, pass its public Purchase Intent ID instead:

```ts
await initializePaymentSheet({
  purchaseIntentId: buyLink.purchaseIntentId,
  returnURL: 'merchant-app://inttegro-return',
});
```

Do not send an `orderId` in this path. The native sheet first shows the
authoritative Buy-link choices: product variant, quantity, customer details,
and—when the price supports it—amount. The sheet gathers payment details
locally, then Inttegro creates the Order and starts payment together only when
the payer presses Pay.
Suggested amounts are shortcuts, not an allow-list.

Enabling `showLineItems` offers an Order summary without opening it for the
payer. If they choose to view the items, the native sheet expands to its
full-height detent as the summary is revealed.

## Present and interpret the result

```ts
const result = await presentPaymentSheet();

switch (result.type) {
  case 'completed':
    await merchantBackend.verifyAndFulfillOrder(result.order.id);
    break;
  case 'canceled':
    restoreCheckoutControls();
    if (result.order) preserveCheckoutContext(result.order.id);
    break;
  case 'failed':
    recordTerminalFailure(result.failure.code);
    showPaymentUnavailable();
    break;
}
```

Recoverable collection failures remain inside the native sheet and do not
resolve the promise. Even a completed result is client experience state: the
merchant backend must retrieve the owner-scoped Order and verify successful
payment before fulfillment.

## Rebuild the native application

The package contains native iOS and Android modules. Rebuild after installation
so React Native Codegen and autolinking can run. Expo applications need a
development build; Expo Go cannot load the custom native module.
