# Publishing the Oura Stream Deck plugin: Marketplace and Oura API research

Researched 2026-11-05 from primary sources only (docs.elgato.com, cloud.ouraring.com, support.ouraring.com, static.ouraring.com). Quotes are kept short. **UNCONFIRMED** means no primary source stated it.

## Key constraints

- **We can't call the plugin "Oura" or use the Oura logo as its icon.** The Oura API and MCP Agreement (effective 2026-06-08), §6(e), forbids using the Oura name or marks "as the name or part of the name or icon" of an app. Elgato also requires that names "not infringe copyright or trademarks". The `Name`, the `Category` ("Oura"), the app icon and the marketplace title all need to change. A descriptive mention in the body text is the most that is likely to be safe, and the agreement does not explicitly permit even that. The UUID `com.rotte.oura` contains the mark too. Users don't see it, but Elgato says not to change UUIDs after publishing, so decide now.
- **Personal access tokens are dead.** The Oura v2 docs say PATs "were deprecated in December 2025 and are no longer available for use." Remove the PAT fallback.
- **Every user must have their own OAuth app, or we need Oura's approval.** An API application is limited to **10 users** until Oura approves it, and you submit for review "from the application's page". The client secret may not be disclosed to third parties (§3(i)). PKCE is supported, but the token endpoint still requires `client_secret`, so a published build cannot hold a shared secret safely. The current approach, where each user enters their own client ID and secret, avoids both problems but makes setup harder.
- **A privacy policy is required by both sides.** Oura requires "a conspicuous privacy policy" (§5(c)), deletion within 72 h of a request (§5(f)), and data minimisation. Elgato requires a privacy policy as an additional product link, plus a way to request deletion, whenever user data is collected.
- **Plan for a demo video and 4 to 10 working days of review.** Elgato requires a video for "paid-service integrations", and an active Oura Membership counts as one. Allow 4 to 10 working days per version.
- **The marketplace assets don't exist yet.** We need a PNG app icon at 288×288, a PNG thumbnail at 1920×960, and at least 3 gallery items (PNG 1920×960 or MP4). The plugin `Icon` must be PNG at 256 and 512 px. SVG is fine for category, action and key icons, which must be monochrome white on a transparent background.
- **Keep the plugin free.** Elgato allows free or paid listings with a 70/30 split. However, Oura §4(a)(xiii) prohibits "charging Users in any manner" for functionality "related to" the Oura API, and §4(f) prohibits implying Oura endorsement.
- **Oura limits are generous for polling, and every request needs a User-Agent.** The documented limit is 5000 requests per 5 minutes, split into per-token and per-app tiers. Requests without a `User-Agent` header may get a 403. Oura users without an active Membership (Gen3 and later) can't use the API at all.

---

## Elgato

### 1. How to publish

- **Steps.** You create an organisation in Maker Console at <https://maker.elgato.com> and sign the Maker Agreement, which you must have "signed ... before submitting a product for review". Then submit through **Home → Create product** and the wizard (Files → Details → Media & release notes).
  Sources: <https://docs.elgato.com/marketplace/become-a-maker>, <https://docs.elgato.com/maker-console/submitting-products>
- **Process.** The flow is Create, Pack (`streamdeck pack`), Upload to Maker Console, Review, Publish. Before you submit, check the plugin and product guidelines, prepare the app icon, and create the gallery. <https://docs.elgato.com/streamdeck/sdk/guides/distribution>
- **Review.** Every new product and every new version is reviewed. Reviewers check:
  - product quality;
  - whether the name, description, release notes and media are accurate and legal;
  - whether supported devices and OS are listed accurately;
  - that all text and media are in English.

  Products that need hardware or "paid-service integrations" must include "a video demonstrating the plugin is fully functional." A product ends up Published, Approved or Rejected. Rejection feedback comes by email from maker@elgato.com, and you then resubmit a new version or a revision. <https://docs.elgato.com/maker-console/review-process>
- **Timeline.** "You should allow 4–10 working days for a review". After approval it can take up to 3 hours to appear on Marketplace. Auto-publish after review is on by default, and you can untick it to hold the release. (Same source.)
- **Fixed after creation.** You can't change the name or the monetisation option in Maker Console; you have to email maker@elgato.com. <https://docs.elgato.com/maker-console/submitting-products>

### 2. Technical requirements

**Manifest.** Source: <https://docs.elgato.com/streamdeck/sdk/references/manifest>

- **Required top-level fields:** `Actions`, `Author`, `CodePath`, `Description`, `Icon`, `Name`, `OS`, `SDKVersion`, `Software`, `UUID`, `Version`.
- **Required action fields:** `Icon`, `Name`, `States[].Image`, `UUID`.
- **`Version`:** `{major}.{minor}.{patch}.{build}`, for example `1.0.0.0`.
- **`SDKVersion`:** 2 or 3, with 3 recommended. Our current value of 2 is valid.
- **`Software.MinimumVersion`:** "6.4" through "7.6".
- **`Nodejs.Version`:** "20", "24" or "26". Our "20" is valid.
- **`OS`:** one or two entries with `Platform` "mac" or "windows". The docs don't say macOS support is required (**UNCONFIRMED** either way). Review checks that the supported OS are listed accurately.
- **`Category`:** optional, and recommended to match `Name`.

**UUIDs.** Reverse-DNS, using only lowercase letters, digits, `-` and `.`. Elgato's rules:

- the UUID must include the author and the plugin name;
- action UUIDs must be prefixed with the plugin UUID;
- "Do not change UUIDs after publishing."

Sources: <https://docs.elgato.com/streamdeck/sdk/references/manifest>, <https://docs.elgato.com/guidelines/stream-deck/plugins>

**Images.** In the manifest, give image paths without a file extension.

| Asset | Format | Size | Source |
|---|---|---|---|
| Plugin `Icon` (manifest) | **PNG only** | 256×256 + 512×512 (@2x) | manifest ref, plugin guidelines |
| Category icon | SVG (recommended) or PNG | 28×28 (56×56 @2x for PNG) | plugin guidelines |
| Action icon | SVG (recommended) or PNG | 20×20 (40×40 @2x for PNG) | plugin guidelines |
| Key image (`States[].Image`) | SVG (recommended), PNG, GIF | 72×72 (144×144 @2x for PNG) | plugin guidelines |
| Touch strip layout | n/a | 200×100 | plugin guidelines |
| Marketplace app icon | PNG, static | 288×288 | <https://docs.elgato.com/guidelines/products> |
| Marketplace thumbnail | PNG, static | 1920×960 | products guidelines |
| Gallery | PNG 1920×960, or MP4 up to 1920×1080 and under 250 MB | 3 to 10 items | products guidelines |

**Icon style.** Category and action icons must be monochrome white (`#FFFFFF`) on a transparent background, with no colour styling. GIF can't be used for key images that are updated programmatically. Keep key updates to 10 per second or fewer. <https://docs.elgato.com/guidelines/stream-deck/plugins>

**Actions list.** Provide "between 2 and 30 actions". Category and action names should be about 30 characters or fewer. (Same source.)

**Property inspector.**

- No Save button: auto-save settings on change.
- No donation or sponsor links.
- No copyright notice.
- Provide setup help links where necessary.

Same source.

**Pack and validate.**

- `streamdeck pack <dir>.sdPlugin` validates the plugin and then produces a `.streamDeckPlugin` file.
- `.sdignore` excludes files from the package.
- `streamdeck validate` uses rule schemas that update automatically once a day. Use `--no-update-check` in CI.

Sources: <https://docs.elgato.com/streamdeck/sdk/guides/distribution>, <https://docs.elgato.com/streamdeck/cli/commands/validate>

**DRM (optional).** DRM is on by default from CLI 1.6. It needs:

- `@elgato/streamdeck` v2 or later;
- `SDKVersion` 3;
- `Software.MinimumVersion` "6.9" or later.

Files must be immutable, and the manifest can't be read at runtime. Staying on SDKVersion 2 means no DRM. <https://docs.elgato.com/streamdeck/sdk/guides/distribution>

**Localisation.** Submitted text and media must be in English. Elgato doesn't say whether plugin UI localisation is required (**UNCONFIRMED**; the localisation guide URL returned 404).

### 3. Content policies

- **Trademarks in the name.** The plugin name "Must not infringe copyright or trademarks" and must accurately reflect what the plugin does. <https://docs.elgato.com/guidelines/stream-deck/plugins>
- **Trademarks in the listing.** The product guidelines add:
  - don't infringe trademarks or impersonate another product;
  - when referencing trademarks, use phrasing like "inspired by";
  - no "Official" unless you own the IP;
  - you must own the rights to the name, description and imagery.

  <https://docs.elgato.com/guidelines/products>
- **Privacy.** Collecting analytical or personal data requires explicit consent and "A privacy policy that clearly outlines the data being collected", attached as an additional link. You must also give users "an easy way" to request deletion and have security measures in place. (Same source.)
- **AI.** Any AI use must be declared, and products made entirely by AI are not eligible. (Same source.)
- **Credentials, network access, health data:** none of the Elgato pages we read have specific rules on these (**UNCONFIRMED**). The general privacy rules above apply. The Maker Agreement is only visible inside Maker Console (Organization → Settings) and was not reviewed.

### 4. Monetisation and support

- **Price and split.** Products can be free or paid, at a 70/30 split with 70% to the Maker. Payouts for paid products go through Stripe Connect, and your country must be supported; free products have no country restriction. Sources: <https://docs.elgato.com/monetization/revenue-share>, <https://docs.elgato.com/marketplace/become-a-maker>
- **Pricing rules.**
  - The price you set in Maker Console is the net price.
  - Access can't depend on an external paywall or subscription.
  - Prices must match those charged elsewhere.

  Sources: <https://docs.elgato.com/maker-console/submitting-products>, <https://docs.elgato.com/guidelines/products>
- **Support contact.** "Additional links, such as support links" are listed among the required items for submission. The same page lists support and privacy-policy links as optional link types, so whether a support link is mandatory is ambiguous (**UNCONFIRMED**). <https://docs.elgato.com/maker-console/submitting-products>

---

## Oura

### 5. API terms

Source: the Oura API and MCP Agreement, effective 2026-06-08, <https://cloud.ouraring.com/legal/api-agreement>.

- **Public distribution.** Allowed. Authorized purposes include using a "Collaborator Application" to build apps "designed to interact with Oura services" (§2(a)(ii)). The API FAQ says it is "free to use for both personal and commercial applications" (<https://cloud.ouraring.com/v2/docs>, FAQ).
- **Commercial restrictions.** Prohibited uses (§4(a)) include:
  - charging Users "in any manner" for functionality related to the Oura API, MCP or Platform (xiii);
  - advertising or marketing uses (vii, viii);
  - competing with or replicating Oura (ix);
  - redistributing User Data (vi);
  - reverse-engineering scoring (xi);
  - storing data beyond what is necessary (x; also §3(m)).

  §4(f) forbids implying endorsement. §4(d) forbids feeding API data to any AI model. Oura may charge fees in the future (§3(h)) and may revoke apps that don't add "benefit to Users" (§4(e)).
- **Credentials.**
  - The client secret may not be shared "with any third party", nor used for more than one app (§3(i)).
  - Apps must "implement secure authentication" and respect rate limits (§3(d)).
  - The Getting Started page says: "The Client Secret should not be shared." <https://cloud.ouraring.com/docs/>
- **Privacy obligations.**
  - Get informed, specific consent, and tell users how to revoke it (§5(a)).
  - Publish a conspicuous privacy policy covering collection, storage, use, sharing, retention and deletion (§5(c)).
  - Protect data with commercially reasonable security (§5(d)).
  - Stop processing on opt-out, and delete within **72 hours** of a request (§5(f)).
  - Minimise data (§4(c)).
  - App terms must disclaim warranties on behalf of third-party providers (§5(i)).
- **10-user limit.** "API Applications are limited to **10** users before requiring approval from Oura. There is no limit once an application is approved." (<https://cloud.ouraring.com/v2/docs>, Data Access). On process: "you can submit it for review from the application's page" (<https://cloud.ouraring.com/docs/>). Neither page documents the review criteria, the information Oura asks for, or the timeline (**UNCONFIRMED**). New apps are created in the "newest developer portal" (developer.ouraring.com). <https://support.ouraring.com/hc/en-us/articles/4415266939155-The-Oura-API> (updated 2026-10-01)
- **Membership.** Gen3 and later users without an active Oura Membership "can't access their data through the Oura API". (Same support article.)

### 6. OAuth details

Source: <https://cloud.ouraring.com/docs/authentication>

- **Endpoints.** Authorize at `https://cloud.ouraring.com/oauth/authorize`; there is also a newer alternative at `https://developer.ouraring.com/authorize`. The token endpoint is `https://api.ouraring.com/oauth/token`.
- **Scopes.** `email personal daily heartrate workout tag session spo2`. The v2 spec also lists `heart_health`. Scopes the user doesn't grant are dropped: users can untick them.
- **PKCE.** `code_challenge` is "Recommended", and the method must be S256.
- **No public client.** On the token exchange, `client_secret` is "Required if not using Basic Authorization", and Basic auth also carries the secret. There is no documented secret-less public-client flow.
- **Implicit (client-side) flow.** Supported via `response_type=token`, but it "does not support refresh tokens". The token expires after 30 days, and then the user must re-authorize.
- **Redirect URIs.** The registered URIs act as a whitelist, and the request parameter "must match one of the URIs exactly". The docs don't say whether `http://localhost` or loopback URIs, or custom schemes, are accepted (**UNCONFIRMED**). Test with the registered `http://localhost:51789/callback`.
- **Refresh token.** "The refresh token is single-use, meaning it is invalidated after being used." Each refresh returns a new refresh token. The refresh-token lifetime isn't documented (**UNCONFIRMED**).
- **Access token lifetime.** It is given per response in `expires_in`. The FAQ says tokens "typically last 30 days" (<https://cloud.ouraring.com/v2/docs>, Troubleshooting).
- **Revocation.** `https://api.ouraring.com/oauth/revoke?access_token=...`

### 7. Personal Access Tokens

"Please note that personal access tokens were deprecated in December 2025 and are no longer available for use." (<https://cloud.ouraring.com/v2/docs>, Authentication; spec openapi-1.43). The cloud portal nav labels them "Personal Access Tokens [Deprecated]".

### 8. Trademark and brand

- **Not in the name or icon.** §6(e) of the API Agreement: you "must not use the Oura name or any Oura trademark ... as the name or part of the name or icon" of any Collaborator Application, nor in its logo or branding. Other limited use is allowed only as the Branding Guidelines describe, and Oura can revoke it.
- **Marks notice.** Site footer: "ŌURA and OURA and Ō are trademarks of Ōura Health Oy and may not be used without permission." <https://cloud.ouraring.com/docs/authentication>
- **Brand guidelines.** The API Brand Guidelines v1 (October 2020, <https://static.ouraring.com/pdfs/Oura_BrandGuidelines_v1.pdf>) cover logo colours, clear space, minimum size (50 px digital), logo don'ts (no recolouring, distortion, effects or added elements) and partnership lockups. They contain no "works with Oura" or "for Oura" naming rules (**UNCONFIRMED** whether such phrasing is allowed). The agreement only reserves partnership or endorsement claims for Oura's written consent (§4(f)).

### 9. Rate limits

- **Documented limit.** "The Oura API is limited to 5000 requests per 5-minute period." (<https://cloud.ouraring.com/v2/docs>, FAQ)
- **Tiers.** Limits apply both per access token and per application.
- **On 429.** The response carries `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Window`, `X-RateLimit-Reset` and `X-RateLimit-Tier`; prefer `Retry-After` over fixed backoff. (Same source, Rate Limits.)
- **User-Agent.** Every request must send a `User-Agent`, or it "may be rejected" with a 403. Sources: <https://cloud.ouraring.com/v2/docs>, <https://cloud.ouraring.com/docs/authentication>
- **Webhooks.** Oura recommends them. They need a publicly reachable endpoint, so they don't fit a local plugin; polling is the only option.
