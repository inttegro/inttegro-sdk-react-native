import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  decodePaymentSheetEvent,
  decodePaymentSheetTelemetryEvent,
  decodePaymentSheetResult,
  normalizeConfiguration,
} from '../lib/contract.js';

const order = {
  id: 'or_123',
  status: 'paid',
  merchant: { displayName: 'Acme' },
  amount: { value: 1500, currency: 'ghs' },
  lineItems: [],
  documents: {},
};

const envelope = {
  flowId: '550e8400-e29b-41d4-a716-446655440000',
  sequence: 4,
  occurredAt: '2026-10-16T10:00:00.000Z',
};

describe('payment-sheet contract', () => {
  it('trims the checkout Order ID', () => {
    assert.equal(
      normalizeConfiguration({ orderId: '  or_test  ' }).orderId,
      'or_test',
    );
  });

  it('normalizes the title and preserves the requested theme', () => {
    assert.deepEqual(
      normalizeConfiguration({
        orderId: 'or_test',
        title: '  Complete contribution  ',
        appearance: { theme: 'dark' },
      }),
      {
        orderId: 'or_test',
        title: 'Complete contribution',
        appearance: { theme: 'dark' },
      },
    );
  });

  it('accepts a customer-selected amount Purchase Intent', () => {
    assert.deepEqual(
      normalizeConfiguration({ purchaseIntentId: '  sale_test  ' }),
      { purchaseIntentId: 'sale_test' },
    );
  });

  it('requires exactly one checkout reference', () => {
    assert.throws(() => normalizeConfiguration({}), /exactly one/);
    assert.throws(
      () =>
        normalizeConfiguration({
          orderId: 'or_test',
          purchaseIntentId: 'sale_test',
        }),
      /exactly one/,
    );
  });

  it('rejects unsafe configuration shapes', () => {
    assert.throws(() => normalizeConfiguration({ orderId: ' ' }), /orderId/);
    assert.throws(
      () =>
        normalizeConfiguration({
          orderId: 'or_test',
          appearance: { primaryColor: '#xyz' },
        }),
      /primaryColor/,
    );
    assert.throws(
      () =>
        normalizeConfiguration({
          orderId: 'or_test',
          title: '   ',
        }),
      /title/,
    );
    assert.throws(
      () =>
        normalizeConfiguration({
          orderId: 'or_test',
          appearance: { theme: 'sepia' },
        }),
      /appearance.theme/,
    );
    assert.throws(
      () =>
        normalizeConfiguration({
          orderId: 'or_test',
          features: { showLineItems: 'yes' },
        }),
      /showLineItems/,
    );
  });

  it('preserves opt-in payment-sheet features', () => {
    const features = {
      showLineItems: true,
      showInvoiceDownload: true,
      showReceiptDownload: true,
      allowPaymentMethodChange: false,
    };
    assert.deepEqual(
      normalizeConfiguration({ orderId: 'or_test', features }).features,
      features,
    );
  });

  it('decodes native results without weakening the union', () => {
    assert.deepEqual(
      decodePaymentSheetResult(
        JSON.stringify({ ...envelope, type: 'completed', order }),
      ),
      {
        ...envelope,
        occurredAt: new Date(envelope.occurredAt),
        type: 'completed',
        order,
      },
    );
    assert.throws(
      () =>
        decodePaymentSheetResult(
          JSON.stringify({ ...envelope, type: 'paymentProcessing', order }),
        ),
      /non-terminal/,
    );
    assert.deepEqual(
      decodePaymentSheetResult(
        JSON.stringify({
          ...envelope,
          type: 'failed',
          order: { ...order, status: 'failed' },
          failure: {
            code: 'payment_failed',
            message: 'Try again.',
            recoverable: false,
          },
        }),
      ),
      {
        ...envelope,
        occurredAt: new Date(envelope.occurredAt),
        type: 'failed',
        order: { ...order, status: 'failed' },
        failure: {
          code: 'payment_failed',
          message: 'Try again.',
          recoverable: false,
        },
      },
    );
  });

  it('decodes application lifecycle independently of telemetry', () => {
    assert.deepEqual(
      decodePaymentSheetEvent(
        JSON.stringify({
          ...envelope,
          type: 'paymentActionRequired',
          order: { ...order, status: 'requires_action' },
          action: { type: 'confirmation' },
        }),
      ),
      {
        ...envelope,
        occurredAt: new Date(envelope.occurredAt),
        type: 'paymentActionRequired',
        order: { ...order, status: 'requires_action' },
        action: { type: 'confirmation' },
      },
    );
    assert.throws(
      () =>
        decodePaymentSheetEvent(
          JSON.stringify({
            ...envelope,
            type: 'completed',
            order: { ...order, paymentId: 'pay_private' },
          }),
        ),
      /invalid lifecycle event/,
    );
  });

  it('validates telemetry configuration and privacy-safe events', () => {
    const traceparent =
      '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    assert.equal(
      normalizeConfiguration({
        orderId: 'or_test',
        telemetry: { traceparent },
      }).telemetry.traceparent,
      traceparent,
    );
    assert.throws(
      () =>
        normalizeConfiguration({
          orderId: 'or_test',
          telemetry: {
            traceparent:
              '00-00000000000000000000000000000000-00f067aa0ba902b7-01',
          },
        }),
      /traceparent/,
    );

    const event = {
      flowId: '550e8400-e29b-41d4-a716-446655440000',
      sequence: 1,
      name: 'inttegro.checkout.load.started',
      timestamp: '2026-09-04T12:00:00.000Z',
      retryAfterSeconds: 30,
    };
    const decodedEvent = decodePaymentSheetTelemetryEvent(
      JSON.stringify(event),
    );
    assert.deepEqual(decodedEvent, {
      ...event,
      timestamp: new Date(event.timestamp),
    });
    assert.throws(
      () =>
        decodePaymentSheetTelemetryEvent(
          JSON.stringify({ ...event, orderId: 'or_private' }),
        ),
      /invalid telemetry event/,
    );
    assert.throws(
      () =>
        decodePaymentSheetTelemetryEvent(
          JSON.stringify({ ...event, timestamp: '2026-09-04T12:00:00' }),
        ),
      /invalid telemetry event/,
    );

    assert.equal(decodedEvent.name, 'inttegro.checkout.load.started');

    const payEvent = decodePaymentSheetTelemetryEvent(
      JSON.stringify({
        ...event,
        name: 'inttegro.request.prepared',
        operation: 'checkout.pay',
      }),
    );
    assert.equal(payEvent.operation, 'checkout.pay');
  });
});
