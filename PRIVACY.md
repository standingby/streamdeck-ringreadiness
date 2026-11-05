# Privacy Policy

*Ring Readiness for Stream Deck. Last updated: 2026-11-05.*

Ring Readiness is a Stream Deck plugin that shows your own Oura Ring data on your own Stream Deck.
It is published by standingby (https://github.com/standingby/ringreadiness). It is not affiliated
with or endorsed by Oura Health Oy.

## What the plugin accesses

With your explicit consent, given on Oura's own authorization page, the plugin reads the following
from the Oura API: daily readiness, sleep and activity scores, steps, daytime stress, sleep
periods (for HRV and lowest heart rate) and heart-rate samples. The requested scopes are `daily`,
`heartrate` and `personal`. It only reads; it never writes to your Oura account.

## Where your data goes

Nowhere except your own PC. The plugin talks directly to `api.ouraring.com` and
`cloud.ouraring.com` over HTTPS using the Oura API application you create yourself. There is no
server operated by the publisher, no analytics, no telemetry, no advertising and no sharing with
any third party. The publisher never receives your data, your tokens or your app credentials.

## What is stored, and where

In `%LOCALAPPDATA%\ringreadiness\` on your PC:

- `auth.json`: your Oura app's client ID and client secret, and the OAuth access and refresh
  tokens. Stored unencrypted, readable by your Windows user account.
- `cache.json`: the last 62 days of the values listed above, so keys show data right after
  Stream Deck starts. Older days are dropped automatically.

Stream Deck stores each action's settings (chosen metric, step goal) in its own profile files.

## Deleting your data

- Press **Disconnect** in any Ring Readiness action's settings. This immediately deletes the OAuth
  tokens and the whole data cache from your PC. Your client ID and secret are kept so you can
  reconnect; delete the folder above to remove them as well.
- Uninstalling the plugin and deleting `%LOCALAPPDATA%\ringreadiness\` removes everything.
- To revoke the plugin's access on Oura's side, delete or reset the secret of your Oura API
  application at https://developer.ouraring.com/applications.

Because the publisher holds no copy of your data, there is nothing for the publisher to delete;
the steps above remove every copy the plugin made.

## Contact

Questions or requests: open an issue at https://github.com/standingby/ringreadiness/issues.
