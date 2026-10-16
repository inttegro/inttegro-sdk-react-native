import type {
  CheckoutAction,
  CheckoutFailure,
  CheckoutMoney,
  CheckoutOrder,
  PaymentSheetConfiguration,
  PaymentSheetEvent,
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
const EVENT_BASE_FIELDS = ['type', 'flowId', 'sequence', 'occurredAt'] as const;
const MONEY_FIELDS = new Set(['value', 'currency']);
const ORDER_FIELDS = new Set([
  'id',
  'status',
  'merchant',
  'amount',
  'expiresAt',
  'lineItems',
  'documents',
]);
const MERCHANT_FIELDS = new Set(['displayName']);
const LINE_ITEM_FIELDS = new Set(['id', 'name', 'quantity', 'total']);
const DOCUMENT_FIELDS = new Set(['invoiceUrl', 'receiptUrl']);
const ACTION_FIELDS = new Set(['type', 'expiresAt']);
const FAILURE_FIELDS = new Set(['code', 'message', 'recoverable']);
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

export function decodePaymentSheetEvent(payload: string): PaymentSheetEvent {
  const value: unknown = JSON.parse(payload);
  if (
    !isRecord(value) ||
    typeof value.type !== 'string' ||
    typeof value.flowId !== 'string' ||
    !UUID.test(value.flowId) ||
    typeof value.sequence !== 'number' ||
    !Number.isInteger(value.sequence) ||
    value.sequence < 1 ||
    typeof value.occurredAt !== 'string' ||
    Number.isNaN(Date.parse(value.occurredAt))
  ) {
    throw new TypeError('The native payment sheet returned an invalid lifecycle event');
  }

  const base = {
    flowId: value.flowId,
    sequence: value.sequence,
    occurredAt: new Date(value.occurredAt),
  };
  switch (value.type) {
    case 'presented':
    case 'ready':
      if (!hasOnlyFields(value, EVENT_BASE_FIELDS)) break;
      return { ...base, type: value.type };
    case 'change':
      if (
        !hasOnlyFields(value, [...EVENT_BASE_FIELDS, 'complete', 'paymentMethod']) ||
        typeof value.complete !== 'boolean' ||
        (value.paymentMethod !== undefined && value.paymentMethod !== 'mobile_money')
      ) {
        break;
      }
      return {
        ...base,
        type: value.type,
        complete: value.complete,
        ...(value.paymentMethod ? { paymentMethod: value.paymentMethod } : {}),
      };
    case 'orderPrepared':
    case 'paymentAttemptStarted':
    case 'paymentProcessing':
    case 'completed': {
      if (!hasOnlyFields(value, [...EVENT_BASE_FIELDS, 'order'])) break;
      const order = decodeOrder(value.order);
      if (!order) break;
      return { ...base, type: value.type, order };
    }
    case 'paymentActionRequired': {
      if (!hasOnlyFields(value, [...EVENT_BASE_FIELDS, 'order', 'action'])) break;
      const order = decodeOrder(value.order);
      const action = decodeAction(value.action);
      if (!order || !action) break;
      return { ...base, type: value.type, order, action };
    }
    case 'paymentAttemptFailed': {
      if (!hasOnlyFields(value, [...EVENT_BASE_FIELDS, 'order', 'failure'])) break;
      const order = decodeOrder(value.order);
      const failure = decodeFailure(value.failure);
      if (!order || !failure) break;
      return { ...base, type: value.type, order, failure };
    }
    case 'canceled': {
      if (!hasOnlyFields(value, [...EVENT_BASE_FIELDS, 'order'])) break;
      const order = value.order === undefined ? undefined : decodeOrder(value.order);
      if (value.order !== undefined && !order) break;
      return { ...base, type: value.type, ...(order ? { order } : {}) };
    }
    case 'failed': {
      if (!hasOnlyFields(value, [...EVENT_BASE_FIELDS, 'order', 'failure'])) break;
      const order = value.order === undefined ? undefined : decodeOrder(value.order);
      const failure = decodeFailure(value.failure);
      if ((value.order !== undefined && !order) || !failure) break;
      return {
        ...base,
        type: value.type,
        ...(order ? { order } : {}),
        failure,
      };
    }
  }
  throw new TypeError('The native payment sheet returned an invalid lifecycle event');
}

export function decodePaymentSheetResult(payload: string): PaymentSheetResult {
  const event = decodePaymentSheetEvent(payload);
  if (event.type === 'completed' || event.type === 'canceled' || event.type === 'failed') {
    return event as PaymentSheetResult;
  }
  throw new TypeError('The native payment sheet returned a non-terminal result');
}

function decodeOrder(value: unknown): CheckoutOrder | null {
  if (
    !isRecord(value) ||
    !hasOnlyFields(value, ORDER_FIELDS) ||
    typeof value.id !== 'string' ||
    value.id.length < 1 ||
    ![
      'requires_payment',
      'requires_action',
      'processing',
      'paid',
      'failed',
      'expired',
      'canceled',
    ].includes(String(value.status)) ||
    !isRecord(value.merchant) ||
    !hasOnlyFields(value.merchant, MERCHANT_FIELDS) ||
    typeof value.merchant.displayName !== 'string' ||
    value.merchant.displayName.length < 1 ||
    !isMoney(value.amount) ||
    !Array.isArray(value.lineItems) ||
    !isRecord(value.documents)
  ) return null;
  const lineItems = value.lineItems.map((item) => {
    if (
      !isRecord(item) ||
      !hasOnlyFields(item, LINE_ITEM_FIELDS) ||
      typeof item.id !== 'string' ||
      item.id.length < 1 ||
      typeof item.name !== 'string' ||
      item.name.length < 1 ||
      (item.quantity !== undefined &&
        (typeof item.quantity !== 'number' ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 0)) ||
      !isMoney(item.total)
    ) return null;
    return {
      id: item.id,
      name: item.name,
      ...(item.quantity === undefined ? {} : { quantity: item.quantity }),
      total: item.total,
    };
  });
  if (lineItems.some((item) => item === null)) return null;
  if (
    !hasOnlyFields(value.documents, DOCUMENT_FIELDS) ||
    (value.expiresAt !== undefined &&
      (typeof value.expiresAt !== 'string' || Number.isNaN(Date.parse(value.expiresAt)))) ||
    (value.documents.invoiceUrl !== undefined && typeof value.documents.invoiceUrl !== 'string') ||
    (value.documents.receiptUrl !== undefined && typeof value.documents.receiptUrl !== 'string')
  ) return null;
  return {
    id: value.id,
    status: value.status as CheckoutOrder['status'],
    merchant: { displayName: value.merchant.displayName },
    amount: value.amount,
    ...(value.expiresAt ? { expiresAt: new Date(value.expiresAt) } : {}),
    lineItems: lineItems as CheckoutOrder['lineItems'],
    documents: {
      ...(value.documents.invoiceUrl ? { invoiceUrl: value.documents.invoiceUrl } : {}),
      ...(value.documents.receiptUrl ? { receiptUrl: value.documents.receiptUrl } : {}),
    },
  };
}

function decodeAction(value: unknown): CheckoutAction | null {
  if (
    !isRecord(value) ||
    !hasOnlyFields(value, ACTION_FIELDS) ||
    !['confirmation', 'authorization', 'redirect'].includes(String(value.type)) ||
    (value.expiresAt !== undefined &&
      (typeof value.expiresAt !== 'string' || Number.isNaN(Date.parse(value.expiresAt))))
  ) return null;
  return {
    type: value.type as CheckoutAction['type'],
    ...(value.expiresAt ? { expiresAt: new Date(value.expiresAt) } : {}),
  };
}

function decodeFailure(value: unknown): CheckoutFailure | null {
  return isRecord(value) &&
    hasOnlyFields(value, FAILURE_FIELDS) &&
    typeof value.code === 'string' &&
    value.code.length > 0 &&
    typeof value.message === 'string' &&
    value.message.length > 0 &&
    typeof value.recoverable === 'boolean'
    ? { code: value.code, message: value.message, recoverable: value.recoverable }
    : null;
}

function isMoney(value: unknown): value is CheckoutMoney {
  return isRecord(value) &&
    hasOnlyFields(value, MONEY_FIELDS) &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value) &&
    Number.isInteger(value.value) &&
    typeof value.currency === 'string' &&
    /^[A-Za-z]{3}$/.test(value.currency);
}

function hasOnlyFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string> | readonly string[],
): boolean {
  const fields = allowed instanceof Set ? allowed : new Set(allowed);
  return Object.keys(value).every((field) => fields.has(field));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
