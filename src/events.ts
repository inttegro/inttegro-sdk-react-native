/**
 * Application-facing payment lifecycle events.
 *
 * Use these events to coordinate host UI and product behavior while the native
 * sheet is open. They are intentionally smaller than the diagnostic telemetry
 * stream and are not authoritative proof that an Order may be fulfilled.
 *
 * @packageDocumentation
 */

import NativeInttegro from './NativeInttegro.js';
import { decodePaymentSheetEvent } from './contract.js';
import type {
  PaymentSheetEvent,
  PaymentSheetEventSubscription,
} from './types.js';

/**
 * Subscribes to typed lifecycle transitions for the active payment sheet.
 *
 * Subscribe before calling `presentPaymentSheet` so the initial `presented`
 * event is not missed. A failed payment attempt is recoverable and leaves the
 * sheet open; terminal behavior belongs to the result returned by presentation.
 * Remove the subscription when the host screen unmounts or after presentation
 * resolves.
 *
 * @param listener - Called in sequence for application-facing lifecycle events.
 * @returns A subscription whose `remove` method detaches the native listener.
 */
export function addPaymentSheetEventListener(
  listener: (event: PaymentSheetEvent) => void
): PaymentSheetEventSubscription {
  return getNativeInttegro().onPaymentSheetEvent((payload) => {
    listener(decodePaymentSheetEvent(payload));
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
