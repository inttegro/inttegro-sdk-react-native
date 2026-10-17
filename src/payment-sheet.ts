/**
 * Configure and present Inttegro's native payment sheet.
 *
 * This module owns the terminal application contract. Recoverable collection
 * failures stay inside the native sheet; the returned result only describes
 * completion, customer cancellation, or a terminal SDK failure.
 *
 * @packageDocumentation
 */

import NativeInttegro from './NativeInttegro.js';
import {
  decodePaymentSheetResult,
  normalizeConfiguration,
} from './contract.js';
import type {
  PaymentSheetConfiguration,
  PaymentSheetResult,
} from './types.js';

/**
 * Validates and stores configuration for the next native payment-sheet
 * presentation.
 *
 * Initialization is deliberately separate from presentation so an application
 * can configure Checkout before opening a modal. It validates client-owned
 * options only; the SDK does not retrieve the Order or begin payment until
 * {@link presentPaymentSheet} is called.
 *
 * Call this again when the checkout reference or presentation options change.
 * Do not include an Inttegro API key: mobile applications use either a public
 * finalized Order ID or a public Purchase Intent ID.
 *
 * @param configuration - Checkout identity, return URL, appearance, telemetry,
 * and optional presentation features.
 * @throws An error when the native module is not linked, another sheet is
 * active, or the configuration is malformed.
 *
 * @example
 * ```ts
 * await initializePaymentSheet({
 *   orderId: checkout.orderId,
 *   returnURL: 'merchant-app://inttegro-return',
 * });
 * ```
 */
export async function initializePaymentSheet(
  configuration: PaymentSheetConfiguration
): Promise<void> {
  const normalized = normalizeConfiguration(configuration);
  await getNativeInttegro().initializePaymentSheet(JSON.stringify(normalized));
}

/**
 * Opens the native payment sheet and resolves once with its terminal result.
 *
 * The native iOS or Android SDK retrieves Checkout, collects a supported
 * payment method, handles confirmation or provider authorization, and keeps
 * recoverable attempt failures inside the sheet. A `completed` result means
 * the client experience reached its success state; fulfillment must still be
 * authorized from the merchant backend using the authoritative Order.
 *
 * Initialize the sheet immediately before presenting it. Only one presentation
 * may be active for a React Native module instance.
 *
 * @returns The terminal completion, cancellation, or failure state.
 * @throws An error when the native module is not linked or the sheet was not
 * initialized.
 */
export async function presentPaymentSheet(): Promise<PaymentSheetResult> {
  return decodePaymentSheetResult(
    await getNativeInttegro().presentPaymentSheet()
  );
}

function getNativeInttegro() {
  if (!NativeInttegro) {
    throw new Error(
      'The Inttegro native module is not linked. Rebuild the application after installing the Inttegro SDK.'
    );
  }
  return NativeInttegro;
}
