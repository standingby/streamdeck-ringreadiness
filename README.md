# Oura for Stream Deck+

Personal Stream Deck plugin that shows Oura Ring data on keys and on the Stream Deck+ dials.
Not published on the Marketplace. See [docs/design.md](docs/design.md) for the full design.

## Actions

| Action | Key | Dial |
| --- | --- | --- |
| **Oura Metric** | One metric (Readiness, Sleep, Activity, Steps, Stress, HRV, Resting HR, latest heart rate). Press: next metric. Hold: refresh. | Rotate: browse up to 30 days back. Push or tap: next metric. Hold push: today + refresh. Hold tap: refresh. |
| **Trend chart** | Last 7 days as bars. Press: next metric. Hold: refresh. | Rotate: select a day. Push or tap: next metric. Hold push: toggle 7 / 30 days. Hold tap: refresh. |
| **Day summary** | Readiness / Sleep / Activity rings. Press: refresh. | The three scores large, steps and data age. Rotate: browse days. Push: today + refresh. |

The metric cycle is Readiness → Sleep → Activity → Steps → Stress → HRV → Resting HR → Heart rate
(charts skip heart rate). A hold is 0.6 s or longer. The chosen metric is saved in the action's
settings, so it survives a restart.

Colours follow Oura's bands for scores (85+ optimal, 70–84 good, below 70 pay attention), steps use
your step goal, stress uses Oura's own day summary. HRV and resting HR show a trend arrow against
your 30-day median. The small text bottom right is the data age; `OFFLINE`, `REAUTH` or `LIMIT`
bottom left means the last fetch failed and the dimmed value is the last one known.

## Setup

1. Create an app at the Oura developer portal with the redirect URI
   `http://localhost:51789/callback`.
2. Build and link:

   ```bash
   npm install
   npm run build
   npm run link
   ```

3. Restart Stream Deck once so it discovers the linked plugin.
4. Drag any Oura action onto a key or dial, open its settings, enter the client ID and secret,
   press **Connect Oura** and approve in the browser.

A personal access token can be entered under *Advanced* instead; it is used only while OAuth is
not connected.

Credentials and the data cache live in `%LOCALAPPDATA%\streamdeck-oura\` (`auth.json`,
`cache.json`), unencrypted.

## Development

```bash
npm test          # vitest
npm run typecheck
npm run watch     # rebuild and restart the plugin on change
npm run validate  # check the manifest
```
