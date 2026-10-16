/**
 * Privacy-safe diagnostics emitted by Inttegro's native payment flow.
 *
 * Inttegro does not install an exporter. The host application decides whether
 * to translate these ordered events into logs, spans, or another diagnostics
 * system it owns.
 *
 * @packageDocumentation
 */

import NativeInttegro from './NativeInttegro.js';
import { decodePaymentSheetTelemetryEvent } from './contract.js';
import type {
  PaymentSheetEventSubscription,
  PaymentSheetTelemetryEvent,
} from './types.js';

/**
 * Subscribes to the native payment sheet's diagnostic event stream.
 *
 * Events contain bounded operation, status, timing, and correlation metadata.
 * They exclude Order and Payment IDs, customer or payer fields, payment-method
 * details, redirect URLs, request and response bodies, and raw error messages.
 * Treat `flowId` and `requestId` as correlation values rather than metric
 * dimensions.
 *
 * Subscribe before presenting the sheet. Event delivery stops when the returned
 * subscription is removed; disabling telemetry in the configuration prevents
 * both emission and W3C trace-context propagation.
 *
 * @param listener - Receives monotonically sequenced events for one native flow.
 * @returns A subscription whose `remove` method detaches the native listener.
 */
export function addPaymentSheetTelemetryListener(
  listener: (event: PaymentSheetTelemetryEvent) => void
): PaymentSheetEventSubscription {
  return getNativeInttegro().onPaymentSheetTelemetryEvent((payload) => {
    listener(decodePaymentSheetTelemetryEvent(payload));
  });
}

function getNativeInttegro() {
  if (!NativeInttegro) {
    throw new Error(
      'The Inttegro native module is not linked. Rebuild the application after installing the Inttegro SDK.'
    );
  }
  return NativeInttegro;
}
