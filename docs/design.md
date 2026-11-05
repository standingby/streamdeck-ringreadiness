# Design

Ring Readiness (`kz.standingby.ringreadiness`): a free, open-source Stream Deck plugin for Oura Ring
data, Windows only. The name avoids the Oura mark (Oura API Agreement §6(e)). Publishing constraints
are in [research/marketplace.md](research/marketplace.md).

## Auth

- OAuth2 only. Oura retired personal access tokens in December 2025. Each user registers their own
  Oura API app (redirect URI `http://localhost:51789/callback`) and enters its client ID and
  secret: Oura requires the secret for every token exchange and forbids sharing it, and a shared
  app would be capped at 10 users.
- Scopes: `daily heartrate personal`. Every request sends a `User-Agent`.
- Everything lives in `%LOCALAPPDATA%\ringreadiness\auth.json`, unencrypted. Pre-release files in
  `%LOCALAPPDATA%\streamdeck-oura` are copied over once.
- Oura refresh tokens are single use: refreshes are single-flight and the new pair is saved
  before it is used.
- Login: the Connect button in any action's property inspector, with a step-by-step guide for
  creating the Oura app. A callback server runs on loopback only during login.
- Disconnect deletes the tokens and the whole data cache (Oura requires deletion on request).
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

- **Ring Metric** (key + dial): metric chosen in settings or by pressing. Press (key, dial push,
  touch tap) cycles to the next metric in fixed order; hold (≥ 0.6 s) refreshes, and on the dial
  also returns to today. Rotate browses days (up to 30 back). Nothing opens the Oura website.
- **Trend Chart** (key + dial): bars in metric colours. Key shows 7 days. Press cycles the daily
  metrics (no heart rate). Dial: hold push toggles 7 / 30 days, rotate moves the highlighted day;
  hold on a key or the touch strip refreshes.
- **Day Summary** (key + dial): dial shows Readiness / Sleep / Activity large with steps and data
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
