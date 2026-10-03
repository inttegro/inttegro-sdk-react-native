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
 * Inttegro installs no exporter. Disabling this configuration prevents both
 * native event emission and trace-header propagation for the presentation.
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
export type PaymentSheetResult =
  | { status: 'completed'; paymentId?: string }
  | { status: 'canceled' }
  | {
      status: 'failed';
      error: {
        code: string;
        message: string;
        declineCode?: string;
        requestId?: string;
        retryAfterSeconds?: number;
      };
    };

/** Application-facing stages in one payment-sheet presentation. */
export type PaymentSheetEventType =
  | 'presented'
  | 'checkoutLoadStarted'
  | 'checkoutLoadSucceeded'
  | 'checkoutLoadFailed'
  | 'paymentAttemptStarted'
  | 'paymentAttemptFailed'
  | 'confirmationRequired'
  | 'authorizationRequired'
  | 'paymentStatusPolling'
  | 'completed'
  | 'canceled'
  | 'failed';

/**
 * A typed lifecycle event for application UI, analytics, and coordination.
 *
 * `paymentAttemptFailed` and `checkoutLoadFailed` are recoverable: the native
 * sheet remains responsible for displaying the failure and offering a retry.
 * Terminal application behavior belongs in the `PaymentSheetResult` returned
 * by `presentPaymentSheet`.
 */
export interface PaymentSheetEvent {
  /** Random identifier shared by events from one sheet presentation. */
  flowId: string;
  /** Monotonically increasing event order within the flow. */
  sequence: number;
  /** Typed lifecycle transition. */
  type: PaymentSheetEventType;
  /** Time at which the native SDK generated the event. */
  timestamp: Date;
  /** Bounded failure category when the transition represents a failure. */
  errorType?: string;
}

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
