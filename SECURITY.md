# Security Policy

## Supported versions

Only the latest release on the Elgato Marketplace and the `master` branch get security fixes.

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

Report privately through GitHub:
[open a private security advisory](https://github.com/standingby/ringreadiness/security/advisories/new).
Include what you found, how to reproduce it and what an attacker could do with it.

You can expect an acknowledgement within 7 days. Confirmed issues are fixed in a new release as
soon as practical, and you are credited in the advisory unless you prefer otherwise.

## Scope

In scope:

- How the plugin stores and handles OAuth tokens and the client secret
  (`%LOCALAPPDATA%\ringreadiness\auth.json`).
- The local OAuth callback server on `localhost:51789` that runs during login.
- The property inspector and its messages to the plugin.
- Anything that could leak health data from the cache or logs.

Out of scope: the Oura API and Oura's own authorization pages (report those to Oura), the Stream
Deck application (report to Elgato), and attacks that need an attacker already running code as
your Windows user, which can read the user's files anyway.

## Known limitation

`auth.json` is stored unencrypted, protected only by Windows file permissions for your user
account. Encrypting it with Windows DPAPI is on the [backlog](docs/backlog.md).
