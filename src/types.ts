/**
 * Shared configuration, result, lifecycle, and telemetry contracts.
 *
 * These values cross a versioned JSON bridge, but the native SDK owns their
 * validation and behavior. They never carry merchant credentials or
 * client-authored commercial terms.
 *
 * @packageDocumentation
 */

/**
 * A six- or eight-digit hexadecimal color accepted by the native sheet.
 *
 * The type provides editor guidance; native validation still rejects malformed
 * values at initialization.
 */
export type HexColor = `#${string}`;

/**
 * Restrained visual overrides applied to the native payment sheet.
 *
 * Omit values to inherit platform and application defaults. Inttegro retains
 * native controls, layout, accessibility behavior, and payment-state semantics.
 */
export interface PaymentSheetAppearance {
  /** Primary action color as `#RRGGBB` or `#RRGGBBAA`. */
  primaryColor?: HexColor;
  /** Sheet surface color as `#RRGGBB` or `#RRGGBBAA`. */
  backgroundColor?: HexColor;
  /** Primary foreground color as `#RRGGBB` or `#RRGGBBAA`. */
  textColor?: HexColor;
  /** Sheet corner radius in points, from 0 through 40. */
  cornerRadius?: number;
}

/**
 * Host-owned diagnostics and W3C trace context.
 *
 * Inttegro installs no exporter. Disabling this configuration prevents
 * diagnostic event emission and trace-header propagation, but not Checkout
 * lifecycle delivery.
 */
export interface PaymentSheetTelemetry {
  /** Whether native SDK telemetry is enabled. Defaults to `true`. */
  enabled?: boolean;
  /** W3C `traceparent` value propagated to Inttegro requests. */
  traceparent?: string;
  /** W3C `tracestate` value propagated to Inttegro requests. */
  tracestate?: string;
}

/**
 * Optional content and actions exposed by the native payment sheet.
 *
 * These flags affect presentation only. They cannot change the Order, amount,
 * currency, shipping address, or customer associated with a saved method.
 */
export interface PaymentSheetFeatures {
  /**
   * Offers a collapsed, expandable Order summary. Opening it expands the
   * native sheet before revealing Checkout-provided items. Defaults to `false`.
   */
  showLineItems?: boolean;
  /** Offers the invoice PDF after payment succeeds. Defaults to `false`. */
  showInvoiceDownload?: boolean;
  /** Offers the receipt after payment succeeds. Defaults to `false`. */
  showReceiptDownload?: boolean;
  /** Lets the payer replace an attached payment method. Defaults to `true`. */
  allowPaymentMethodChange?: boolean;
}

/**
 * Configuration stored for the next native payment-sheet presentation.
 *
 * The `orderId` is the public ID returned by a merchant backend after it creates
 * and finalizes an Order. Never pass a merchant API key into a mobile app.
 */
export type PaymentSheetConfiguration = {
  /** Absolute deep link that resumes the application after external steps. */
  returnURL?: string;
  /** Optional native appearance overrides. */
  appearance?: PaymentSheetAppearance;
  /** Optional SDK diagnostics and distributed-trace configuration. */
  telemetry?: PaymentSheetTelemetry;
  /** Optional payment-sheet content and actions. */
  features?: PaymentSheetFeatures;
} & (
  | {
      /** Client-safe ID of an Order finalized by the merchant backend. */
      orderId: string;
      purchaseIntentId?: never;
    }
  | {
      orderId?: never;
      /** Client-safe Purchase Intent whose amount the payer will choose. */
      purchaseIntentId: string;
    }
);

/**
 * Terminal outcome of one native payment-sheet presentation.
 *
 * Recoverable collection failures do not produce a result; the native sheet
 * stays open and lets the payer retry. A `completed` result means the client
 * experience reached success, but the merchant backend must still retrieve the
 * owner-scoped Order before fulfillment.
 */
export interface CheckoutMoney {
  value: number;
  currency: string;
}

export interface CheckoutOrder {
  id: string;
  status:
    | 'requires_payment'
    | 'requires_action'
    | 'processing'
    | 'paid'
    | 'failed'
    | 'expired'
    | 'canceled';
  merchant: { displayName: string };
  amount: CheckoutMoney;
  expiresAt?: Date;
  lineItems: Array<{
    id: string;
    name: string;
    quantity?: number;
    total: CheckoutMoney;
  }>;
  documents: { invoiceUrl?: string; receiptUrl?: string };
}

export interface CheckoutAction {
  type: 'confirmation' | 'authorization' | 'redirect';
  expiresAt?: Date;
}

export interface CheckoutFailure {
  code: string;
  message: string;
  recoverable: boolean;
}

/** Application-facing stages in one payment-sheet presentation. */
export type PaymentSheetEventType =
  | 'presented'
  | 'ready'
  | 'change'
  | 'orderPrepared'
  | 'paymentAttemptStarted'
  | 'paymentActionRequired'
  | 'paymentProcessing'
  | 'paymentAttemptFailed'
  | 'completed'
  | 'canceled'
  | 'failed';

/**
 * A typed lifecycle event for application UI, analytics, and coordination.
 *
 * `paymentAttemptFailed` is recoverable: the native sheet remains responsible
 * for displaying the failure and offering a retry.
 * Terminal application behavior belongs in the `PaymentSheetResult` returned
 * by `presentPaymentSheet`.
 */
interface PaymentSheetEventBase {
  /** Random identifier shared by events from one sheet presentation. */
  flowId: string;
  /** Monotonically increasing event order within the flow. */
  sequence: number;
  /** Time at which the native SDK generated the event. */
  occurredAt: Date;
}

export type PaymentSheetEvent =
  | (PaymentSheetEventBase & { type: 'presented' | 'ready' })
  | (PaymentSheetEventBase & {
      type: 'change';
      complete: boolean;
      paymentMethod?: 'mobile_money';
    })
  | (PaymentSheetEventBase & {
      type:
        | 'orderPrepared'
        | 'paymentAttemptStarted'
        | 'paymentProcessing'
        | 'completed';
      order: CheckoutOrder;
    })
  | (PaymentSheetEventBase & {
      type: 'paymentActionRequired';
      order: CheckoutOrder;
      action: CheckoutAction;
    })
  | (PaymentSheetEventBase & {
      type: 'paymentAttemptFailed';
      order: CheckoutOrder;
      failure: CheckoutFailure;
    })
  | (PaymentSheetEventBase & {
      type: 'canceled';
      order?: CheckoutOrder;
    })
  | (PaymentSheetEventBase & {
      type: 'failed';
      order?: CheckoutOrder;
      failure: CheckoutFailure;
    });

/** Terminal lifecycle event returned when the native sheet closes. */
export type PaymentSheetResult = Extract<
  PaymentSheetEvent,
  { type: 'completed' | 'canceled' | 'failed' }
>;

/** Stable wire names emitted by the native SDK diagnostic stream. */
export type PaymentSheetTelemetryEventName =
  | 'inttegro.payment_sheet.presented'
  | 'inttegro.checkout.load.started'
  | 'inttegro.checkout.load.succeeded'
  | 'inttegro.checkout.load.failed'
  | 'inttegro.payment.attempt.started'
  | 'inttegro.payment.attempt.failed'
  | 'inttegro.payment.confirmation.required'
  | 'inttegro.payment.authorization.required'
  | 'inttegro.payment.status.polling'
  | 'inttegro.payment_sheet.completed'
  | 'inttegro.payment_sheet.canceled'
  | 'inttegro.payment_sheet.failed'
  | 'inttegro.request.prepared'
  | 'inttegro.http.attempt.started'
  | 'inttegro.response.received'
  | 'inttegro.response.decoded'
  | 'inttegro.request.failed';

/**
 * Privacy-safe diagnostic event emitted during a sheet presentation.
 *
 * The stream excludes Order and Payment IDs, customer and payer fields,
 * payment-method details, addresses, bodies, redirect URLs, and raw error
 * messages. Treat `flowId` and `requestId` as correlation values, not metric
 * dimensions.
 */
export interface PaymentSheetTelemetryEvent {
  /** Random identifier shared by events from one sheet presentation. */
  flowId: string;
  /** Monotonically increasing event order within the flow. */
  sequence: number;
  /** Stable diagnostic wire name. */
  name: PaymentSheetTelemetryEventName;
  /** Time at which the native SDK generated the event. */
  timestamp: Date;
  /** Checkout network operation associated with this event. */
  operation?:
    | 'checkout.lookup'
    | 'checkout.pay'
    | 'checkout.request_confirmation'
    | 'checkout.confirm_payment';
  /** HTTP response status when one was received. */
  httpStatusCode?: number;
  /** Safe request identifier returned by the Inttegro API. */
  requestId?: string;
  /** Bounded server-directed delay before retrying the operation. */
  retryAfterSeconds?: number;
  /** Bounded failure category without a raw error message. */
  errorType?: string;
}

/** Removable native event subscription. */
export interface PaymentSheetEventSubscription {
  /** Stops delivering events to the listener. */
  remove(): void;
}
