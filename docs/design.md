# Design

Personal Stream Deck+ plugin for Oura Ring data. Installed with `streamdeck link`, not published.
Garmin is out of scope for now; only the metric value model is provider-agnostic.

## Auth

- OAuth2 is primary, a Personal Access Token (PAT) is the fallback. Register your own app in the
  Oura developer portal with redirect URI `http://localhost:51789/callback`.
- Scopes: `daily heartrate personal`.
- Everything lives in `%LOCALAPPDATA%\streamdeck-oura\auth.json`, unencrypted: OAuth tokens,
  client id and secret, PAT. Writes are atomic (temp file + rename).
- Oura refresh tokens are single use: refreshes are single-flight and the new pair is saved
  before it is used.
- Login: the Connect button in any action's property inspector. A callback server runs on
  loopback only during login (5 min timeout, `state` checked).
- Not connected: keys show "Connect"; pressing starts login.

## Metrics

| Id | Source | Display | Colour |
| --- | --- | --- | --- |
| readiness | `daily_readiness.score` | score | Oura bands 85+ / 70–84 / <70 |
| sleep | `daily_sleep.score` | score | Oura bands |
| activity | `daily_activity.score` | score | Oura bands |
| steps | `daily_activity.steps` | count | % of configurable goal (default 8000) |
| stress | `daily_stress.stress_high` | time in high stress | `day_summary` category |
| hrv | `sleep.average_hrv` (long_sleep) | ms | neutral + trend vs 30-day median |
| rhr | `sleep.lowest_heart_rate` (long_sleep) | bpm | neutral + trend vs 30-day median |
| hr | latest `heartrate` sample | bpm | neutral, age of sample |

Days are local calendar days as Oura assigns them.

## Actions

- **Oura Metric** (key + dial): metric chosen in settings or by pressing. Press (key, dial push,
  touch tap) cycles to the next metric in fixed order; hold (≥ 0.6 s) refreshes, and on the dial
  also returns to today. Rotate browses days (up to 30 back). Nothing opens the Oura website.
- **Trend chart** (key + dial): bars in metric colours. Key shows 7 days. Press cycles the daily
  metrics (no heart rate). Dial: hold push toggles 7 / 30 days, rotate moves the highlighted day;
  hold on a key or the touch strip refreshes.
- **Day summary** (key + dial): dial shows Readiness / Sleep / Activity large with steps and data
  age; key shows three coloured rings.

## Loading

- Start: disk cache, then a full 31-day fetch.
- Every 15 min: last 3 days. Once a day: full pass.
- Heart rate: every 5 min, only while an action showing it is visible, 24-hour window (samples
  arrive only when the ring syncs, so the latest can be hours old).
- Nothing visible: nothing polls. Any press refreshes immediately.

## States

- No data for the day: the previous value, dimmed, labelled `yday` or with its date.
- Error: last value dimmed plus `offline`, `reauth` or `limit` (429 retried per Retry-After).
- `showAlert` only when a manual press fails.
- Data age always shown: since last successful fetch for daily metrics, since the sample for HR.

## Rendering

Own SVG as data URIs: keys 144×144 via `setImage`, dial strip 200×100 via a custom layout with one
pixmap. Dark background, Segoe UI.

## Stack

TypeScript, `@elgato/streamdeck` 2.x, rollup, `@elgato/cli` as a dev dependency (`npx streamdeck`),
plain HTML property inspectors, own fetch-based Oura client, vitest with synthetic fixtures.
