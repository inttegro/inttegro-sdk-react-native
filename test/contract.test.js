import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  decodePaymentSheetTelemetryEvent,
  decodePaymentSheetResult,
  normalizeConfiguration,
  toPaymentSheetEvent,
} from '../lib/contract.js';

describe('payment-sheet contract', () => {
  it('trims the checkout Order ID', () => {
    assert.equal(
      normalizeConfiguration({ orderId: '  or_test  ' }).orderId,
      'or_test',
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
        JSON.stringify({ status: 'completed', paymentId: 'py_123' }),
      ),
      { status: 'completed', paymentId: 'py_123' },
    );
    assert.throws(
      () => decodePaymentSheetResult(JSON.stringify({ status: 'pending' })),
      /unknown status/,
    );
    assert.deepEqual(
      decodePaymentSheetResult(
        JSON.stringify({
          status: 'failed',
          error: {
            code: 'checkout_http_503',
            message: 'Try again.',
            requestId: 'req_test',
            retryAfterSeconds: 30,
          },
        }),
      ),
      {
        status: 'failed',
        error: {
          code: 'checkout_http_503',
          message: 'Try again.',
          requestId: 'req_test',
          retryAfterSeconds: 30,
        },
      },
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

    assert.deepEqual(toPaymentSheetEvent(decodedEvent), {
      flowId: event.flowId,
      sequence: event.sequence,
      type: 'checkoutLoadStarted',
      timestamp: new Date(event.timestamp),
    });
    assert.equal(
      toPaymentSheetEvent({
        ...decodedEvent,
        name: 'inttegro.payment.confirmation.required',
      }).type,
      'confirmationRequired',
    );
    assert.equal(
      toPaymentSheetEvent({
        ...decodedEvent,
        name: 'inttegro.payment.authorization.required',
      }).type,
      'authorizationRequired',
    );
    assert.equal(
      toPaymentSheetEvent({
        ...decodedEvent,
        name: 'inttegro.payment.status.polling',
      }).type,
      'paymentStatusPolling',
    );
    assert.equal(
      toPaymentSheetEvent({
        ...decodedEvent,
        name: 'inttegro.request.prepared',
        operation: 'checkout.lookup',
      }),
      null,
    );
  });
});
