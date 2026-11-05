# Contributing

Thanks for helping with Ring Readiness. Bug reports, ideas and pull requests are all welcome.

## Reporting bugs and asking for features

Use the [issue templates](https://github.com/standingby/ringreadiness/issues/new/choose). For a
bug, include your Stream Deck model and app version, the plugin version, what you pressed and
what the key showed.

**Never paste tokens, your client secret or your health data.** If a log helps, it lives in
`%APPDATA%\Elgato\StreamDeck\Plugins\kz.standingby.ringreadiness.sdPlugin\logs\`; check it and
redact anything personal first.

Security problems go through the private channel in [SECURITY.md](SECURITY.md), not public issues.

## Development setup

Requirements: Windows, Stream Deck 6.9 or later, Node.js 20 or later, and your own Oura API app
(see the README).

```bash
npm install
npm run build
npm run link      # registers the plugin folder with Stream Deck; restart Stream Deck once
npm run watch     # rebuild and restart the plugin on every change
```

Before opening a pull request:

```bash
npm run typecheck
npm test
npm run validate
```

## How the code is organised

- `src/oura/`: Oura API client, OAuth login and token storage.
- `src/data/`: metric model (provider-neutral) and the shared loader with its disk cache.
- `src/render/`: SVG rendering for keys (144×144) and dial strips (200×100).
- `src/actions/`: the three Stream Deck actions.
- `kz.standingby.ringreadiness.sdPlugin/`: manifest, property inspector, icons.

Design decisions are in [docs/design.md](docs/design.md).

## Pull request guidelines

- Keep changes focused; one topic per pull request.
- Add or update tests for behaviour changes; pure logic lives in `src/data` and `src/render` so it
  can be tested without Stream Deck.
- Do not add runtime dependencies without a good reason; the plugin ships as one small bundle.
- Never use the Oura name or logo in the plugin name, icons or key images. Oura's API agreement
  forbids it.
- Update the README when you change what a key or dial does.

By contributing you agree that your work is released under the [MIT License](LICENSE) and that you
follow the [Code of Conduct](CODE_OF_CONDUCT.md).
