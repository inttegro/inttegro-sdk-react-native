/**
 * Inttegro's React Native SDK.
 *
 * The root module is a compatibility-friendly convenience export. New code can
 * import the payment sheet, lifecycle events, and diagnostic telemetry from
 * focused subpaths when that makes ownership clearer.
 *
 * @packageDocumentation
 */

export {
  initializePaymentSheet,
  presentPaymentSheet,
} from './payment-sheet.js';
export { addPaymentSheetEventListener } from './events.js';
export { addPaymentSheetTelemetryListener } from './telemetry.js';

export type {
  CheckoutAction,
  CheckoutFailure,
  CheckoutMoney,
  CheckoutOrder,
  HexColor,
  PaymentSheetAppearance,
  PaymentSheetConfiguration,
  PaymentSheetEvent,
  PaymentSheetEventSubscription,
  PaymentSheetEventType,
  PaymentSheetFeatures,
  PaymentSheetResult,
  PaymentSheetTelemetry,
  PaymentSheetTelemetryEvent,
  PaymentSheetTelemetryEventName,
} from './types.js';
