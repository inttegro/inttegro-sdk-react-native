# Changelog

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
