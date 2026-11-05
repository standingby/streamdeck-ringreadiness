# Backlog

Parked on 2026-11-05 after the MVP. Revisit after some real use.

## Hardening

- **Encrypt `auth.json`** with Windows DPAPI. Node has no built-in DPAPI, so it needs a native
  module or a PowerShell call. Today the file is plain text in `%LOCALAPPDATA%\streamdeck-oura\`.
- **Move to `@elgato/streamdeck` v3.** The MVP uses 2.1.2; v3.0 shipped 2026-09-22 and its API
  changes were not reviewed.
- **`npm audit` warnings.** `deepmerge` (via `@rollup/plugin-node-resolve`, build only) and `zod`
  (via `@elgato/utils`, runtime, local input only). The audit's only fixes are major downgrades.
- **PAT deprecation.** Oura may retire personal access tokens; OAuth is already the primary path,
  so the fallback can simply be removed if that happens.

## Features

- More metrics: SpO2 (`daily_spo2`), temperature deviation (readiness contributors), ring battery
  (`ring_battery_level`).
- Garmin, as a separate effort. The metric model in `src/data/metrics.ts` is provider-neutral;
  data access is the open question (no official personal API).
