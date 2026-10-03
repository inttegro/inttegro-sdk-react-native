import type {
  PaymentSheetConfiguration,
  PaymentSheetEvent,
  PaymentSheetEventType,
  PaymentSheetResult,
  PaymentSheetTelemetryEvent,
  PaymentSheetTelemetryEventName,
} from './types.js';

const HEX_COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const TRACE_PARENT =
  /^(?!ff)[0-9a-f]{2}-(?!0{32})[0-9a-f]{32}-(?!0{16})[0-9a-f]{16}-[0-9a-f]{2}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TELEMETRY_EVENT_NAMES = new Set<PaymentSheetTelemetryEventName>([
  'inttegro.payment_sheet.presented',
  'inttegro.checkout.load.started',
  'inttegro.checkout.load.succeeded',
  'inttegro.checkout.load.failed',
  'inttegro.payment.attempt.started',
  'inttegro.payment.attempt.failed',
  'inttegro.payment.confirmation.required',
  'inttegro.payment.authorization.required',
  'inttegro.payment.status.polling',
  'inttegro.payment_sheet.completed',
  'inttegro.payment_sheet.canceled',
  'inttegro.payment_sheet.failed',
  'inttegro.request.prepared',
  'inttegro.http.attempt.started',
  'inttegro.response.received',
  'inttegro.response.decoded',
  'inttegro.request.failed',
]);
const TELEMETRY_OPERATIONS = new Set([
  'checkout.lookup',
  'checkout.select_amount',
  'checkout.pay',
  'checkout.request_confirmation',
  'checkout.confirm_payment',
]);
const TELEMETRY_EVENT_FIELDS = new Set([
  'flowId',
  'sequence',
  'name',
  'timestamp',
  'operation',
  'httpStatusCode',
  'requestId',
  'retryAfterSeconds',
  'errorType',
]);
const LIFECYCLE_EVENT_TYPES: Partial<
  Record<PaymentSheetTelemetryEventName, PaymentSheetEventType>
> = {
  'inttegro.payment_sheet.presented': 'presented',
  'inttegro.checkout.load.started': 'checkoutLoadStarted',
  'inttegro.checkout.load.succeeded': 'checkoutLoadSucceeded',
  'inttegro.checkout.load.failed': 'checkoutLoadFailed',
  'inttegro.payment.attempt.started': 'paymentAttemptStarted',
  'inttegro.payment.attempt.failed': 'paymentAttemptFailed',
  'inttegro.payment.confirmation.required': 'confirmationRequired',
  'inttegro.payment.authorization.required': 'authorizationRequired',
  'inttegro.payment.status.polling': 'paymentStatusPolling',
  'inttegro.payment_sheet.completed': 'completed',
  'inttegro.payment_sheet.canceled': 'canceled',
  'inttegro.payment_sheet.failed': 'failed',
};

export function normalizeConfiguration(
  configuration: PaymentSheetConfiguration,
): PaymentSheetConfiguration {
  const orderId = configuration.orderId?.trim();
  const purchaseIntentId = configuration.purchaseIntentId?.trim();
  if (Boolean(orderId) === Boolean(purchaseIntentId)) {
    throw new TypeError('Provide exactly one of orderId or purchaseIntentId');
  }

  if (configuration.returnURL) {
    let url: URL;
    try {
      url = new URL(configuration.returnURL);
    } catch {
      throw new TypeError('returnURL must be an absolute URL');
    }
    if (!url.protocol) {
      throw new TypeError('returnURL must be an absolute URL');
    }
  }

  const appearance = configuration.appearance;
  if (appearance?.cornerRadius !== undefined) {
    if (
      !Number.isFinite(appearance.cornerRadius) ||
      appearance.cornerRadius < 0 ||
      appearance.cornerRadius > 40
    ) {
      throw new TypeError('appearance.cornerRadius must be between 0 and 40');
    }
  }

  for (const [name, color] of Object.entries({
    primaryColor: appearance?.primaryColor,
    backgroundColor: appearance?.backgroundColor,
    textColor: appearance?.textColor,
  })) {
    if (color !== undefined && !HEX_COLOR.test(color)) {
      throw new TypeError(
        `appearance.${name} must be a six or eight digit hex color`,
      );
    }
  }

  const telemetry = configuration.telemetry;
  if (
    telemetry?.enabled !== undefined &&
    typeof telemetry.enabled !== 'boolean'
  ) {
    throw new TypeError('telemetry.enabled must be a boolean');
  }
  if (
    telemetry?.traceparent !== undefined &&
    !TRACE_PARENT.test(telemetry.traceparent)
  ) {
    throw new TypeError(
      'telemetry.traceparent must be a valid W3C trace parent',
    );
  }
  if (
    telemetry?.tracestate !== undefined &&
    (telemetry.tracestate.length > 512 || /[\r\n]/.test(telemetry.tracestate))
  ) {
    throw new TypeError(
      'telemetry.tracestate must be at most 512 characters without newlines',
    );
  }

  const features = configuration.features;
  for (const [name, enabled] of Object.entries({
    showLineItems: features?.showLineItems,
    showInvoiceDownload: features?.showInvoiceDownload,
    showReceiptDownload: features?.showReceiptDownload,
    allowPaymentMethodChange: features?.allowPaymentMethodChange,
  })) {
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      throw new TypeError(`features.${name} must be a boolean`);
    }
  }

  return {
    ...configuration,
    ...(orderId ? { orderId } : { purchaseIntentId: purchaseIntentId! }),
  } as PaymentSheetConfiguration;
}

export function decodePaymentSheetTelemetryEvent(
  payload: string,
): PaymentSheetTelemetryEvent {
  const value: unknown = JSON.parse(payload);
  if (
    !isRecord(value) ||
    Object.keys(value).some((field) => !TELEMETRY_EVENT_FIELDS.has(field)) ||
    typeof value.flowId !== 'string' ||
    !UUID.test(value.flowId) ||
    typeof value.sequence !== 'number' ||
    !Number.isInteger(value.sequence) ||
    value.sequence < 1 ||
    typeof value.name !== 'string' ||
    !TELEMETRY_EVENT_NAMES.has(value.name as PaymentSheetTelemetryEventName) ||
    typeof value.timestamp !== 'string' ||
    !/(?:Z|[+-]\d{2}:\d{2})$/.test(value.timestamp) ||
    Number.isNaN(Date.parse(value.timestamp))
  ) {
    throw new TypeError(
      'The native payment sheet returned an invalid telemetry event',
    );
  }
  if (
    value.operation !== undefined &&
    (typeof value.operation !== 'string' ||
      !TELEMETRY_OPERATIONS.has(value.operation))
  ) {
    throw new TypeError(
      'The native payment sheet returned an invalid telemetry operation',
    );
  }
  if (
    value.httpStatusCode !== undefined &&
    (typeof value.httpStatusCode !== 'number' ||
      !Number.isInteger(value.httpStatusCode) ||
      value.httpStatusCode < 100 ||
      value.httpStatusCode > 599)
  ) {
    throw new TypeError(
      'The native payment sheet returned an invalid HTTP status',
    );
  }
  if (
    value.retryAfterSeconds !== undefined &&
    (typeof value.retryAfterSeconds !== 'number' ||
      !Number.isInteger(value.retryAfterSeconds) ||
      value.retryAfterSeconds < 0 ||
      value.retryAfterSeconds > 300)
  ) {
    throw new TypeError(
      'The native payment sheet returned an invalid retry delay',
    );
  }
  for (const field of ['requestId', 'errorType'] as const) {
    const fieldValue = value[field];
    const maxLength = field === 'requestId' ? 255 : 64;
    if (
      fieldValue !== undefined &&
      (typeof fieldValue !== 'string' ||
        fieldValue.length < 1 ||
        fieldValue.length > maxLength)
    ) {
      throw new TypeError(
        `The native payment sheet returned an invalid ${field}`,
      );
    }
  }
  return {
    ...value,
    timestamp: new Date(value.timestamp),
  } as PaymentSheetTelemetryEvent;
}

/** Converts a native diagnostic event into an application-facing lifecycle event. */
export function toPaymentSheetEvent(
  event: PaymentSheetTelemetryEvent,
): PaymentSheetEvent | null {
  const type = LIFECYCLE_EVENT_TYPES[event.name];
  if (!type) return null;
  return {
    flowId: event.flowId,
    sequence: event.sequence,
    type,
    timestamp: event.timestamp,
    ...(event.errorType ? { errorType: event.errorType } : {}),
  };
}

export function decodePaymentSheetResult(payload: string): PaymentSheetResult {
  const value: unknown = JSON.parse(payload);
  if (!isRecord(value) || typeof value.status !== 'string') {
    throw new TypeError('The native payment sheet returned an invalid result');
  }

  if (value.status === 'canceled') return { status: 'canceled' };
  if (value.status === 'completed') {
    if (value.paymentId !== undefined && typeof value.paymentId !== 'string') {
      throw new TypeError(
        'The native payment sheet returned an invalid paymentId',
      );
    }
    return {
      status: 'completed',
      ...(value.paymentId ? { paymentId: value.paymentId } : {}),
    };
  }
  if (
    value.status === 'failed' &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  ) {
    if (
      value.error.declineCode !== undefined &&
      typeof value.error.declineCode !== 'string'
    ) {
      throw new TypeError(
        'The native payment sheet returned an invalid declineCode',
      );
    }
    if (
      value.error.requestId !== undefined &&
      (typeof value.error.requestId !== 'string' ||
        value.error.requestId.length < 1 ||
        value.error.requestId.length > 255)
    ) {
      throw new TypeError(
        'The native payment sheet returned an invalid requestId',
      );
    }
    if (
      value.error.retryAfterSeconds !== undefined &&
      (typeof value.error.retryAfterSeconds !== 'number' ||
        !Number.isInteger(value.error.retryAfterSeconds) ||
        value.error.retryAfterSeconds < 0 ||
        value.error.retryAfterSeconds > 300)
    ) {
      throw new TypeError(
        'The native payment sheet returned an invalid retry delay',
      );
    }
    return {
      status: 'failed',
      error: {
        code: value.error.code,
        message: value.error.message,
        ...(value.error.declineCode
          ? { declineCode: value.error.declineCode }
          : {}),
        ...(value.error.requestId ? { requestId: value.error.requestId } : {}),
        ...(value.error.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: value.error.retryAfterSeconds }
          : {}),
      },
    };
  }
  throw new TypeError('The native payment sheet returned an unknown status');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
