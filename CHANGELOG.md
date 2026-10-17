# Changelog

## Unreleased

## 0.6.2 - 2026-10-17

- Add configurable payment-sheet titles.
- Support light, dark, and system appearance modes through the native bridge.
- Update the native iOS and Android dependency to 0.4.3.

## 0.6.1 - 2026-10-17

- Support fixed-price, customer-selected, and variant Buy links without
  creating an Order until the payer presses Pay in the native sheet.
- Update the native iOS and Android dependency to 0.4.2.

## 0.6.0 - 2026-10-16

- Align the React Native bridge with the canonical web and native Checkout
  lifecycle, including flow IDs and monotonic event sequences.
- Return the exact terminal lifecycle event from `presentPaymentSheet()` and
  include the client-safe Order snapshot when Checkout completes.
- Add payment-action, processing, recoverable-attempt-failure, cancellation,
  and terminal-failure events with sanitized payloads.
- Update the native iOS and Android dependency to 0.4.0.

## 0.5.0 - 2026-10-03

- Honor server-directed retry delays for transient Checkout mutations.
- Expose request IDs and retry delays in failure results and telemetry.
- Support customer-selected amounts for Purchase Intents and editable line items
  in mixed-price Orders.
- Update the native iOS and Android dependency to 0.3.0.

## 0.4.0 - 2026-09-10

- Add focused package entry points for payment sheet, events, telemetry, and types.
- Add payment-sheet lifecycle events and telemetry support.
- Decode SDK event timestamps as JavaScript `Date` values.

## 0.3.0

- Add the initial native payment-sheet implementation for iOS and Android.
