# Ring Readiness for Stream Deck

Readiness, sleep, activity, stress, HRV and heart rate from your Oura Ring on Stream Deck keys
and Stream Deck+ dials. Windows only.

*Not affiliated with or endorsed by Oura. Oura is a trademark of Oura Health Oy.*

## Actions

| Action | Key | Dial |
| --- | --- | --- |
| **Ring Metric** | One metric (Readiness, Sleep, Activity, Steps, Stress, HRV, Resting HR, latest heart rate). Press: next metric. Hold: refresh. | Rotate: browse up to 30 days back. Push or tap: next metric. Hold push: today + refresh. Hold tap: refresh. |
| **Trend Chart** | Last 7 days as bars. Press: next metric. Hold: refresh. | Rotate: select a day. Push or tap: next metric. Hold push: toggle 7 / 30 days. Hold tap: refresh. |
| **Day Summary** | Readiness / Sleep / Activity rings. Press: refresh. | The three scores large, steps and data age. Rotate: browse days. Push: today + refresh. |

The metric cycle is Readiness → Sleep → Activity → Steps → Stress → HRV → Resting HR → Heart rate
(charts skip heart rate). A hold is 0.6 s or longer. The chosen metric is saved with the action.

Colours follow the usual score bands (85+ optimal, 70–84 good, below 70 pay attention), steps use
your step goal, stress uses the day summary from your ring. HRV and resting HR show a trend arrow
against your 30-day median. Bottom right is the data age; `OFFLINE`, `REAUTH` or `LIMIT` bottom
left means the last fetch failed and the dimmed value is the last one known.

## Requirements

- Windows 10 or later, Stream Deck 6.9 or later.
- An Oura Ring with an active Oura Membership (the Oura API serves data only to members).
- Your own free Oura API application (below). The plugin has no server of its own: it talks to the
  Oura API directly from your PC with your app's credentials.

## Connect your ring

1. Go to [developer.ouraring.com](https://developer.ouraring.com) and sign in with your Oura account.
2. Create a new application. Any name works; Oura asks for website, privacy policy and terms URLs,
   which can point to any page you own (for example your GitHub profile).
3. Add the redirect URI **`http://localhost:51789/callback`** exactly as written.
4. Enable the **daily**, **heartrate** and **personal** scopes and save.
5. In Stream Deck, drag any Ring Readiness action onto a key or dial and open its settings.
6. Paste the **Client ID** and **Client Secret** from your Oura app and press **Connect to Oura**.
7. Approve access in the browser window that opens. The keys fill in within a few seconds.

Your app stays in Oura's "Development" status, which is fine: it is only ever used by you.

## Privacy

Everything stays on your PC. See [PRIVACY.md](PRIVACY.md). **Disconnect** in the action settings
deletes your tokens and all cached data.

## Development

```bash
npm install
npm run build     # bundle into kz.standingby.ringreadiness.sdPlugin/bin
npm run link      # register the plugin folder with Stream Deck (restart Stream Deck once)
npm test          # vitest
npm run typecheck
npm run watch     # rebuild and restart the plugin on change
npm run validate  # check the manifest
```

Design notes: [docs/design.md](docs/design.md). License: [MIT](LICENSE).
