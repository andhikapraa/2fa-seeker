# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic versioning.

## [1.1.0] - 2026-07-23

### Added

- Display-only `GET /s/<BASE32_SECRET>` route that returns CSS-free HTML with one large TOTP code.
- Automatic HTML refresh at the next TOTP rollover without CSS or JavaScript.

## [1.0.0] - 2026-07-22

### Added

- Browser-local TOTP generation with SHA-1, SHA-256, SHA-512, 6 or 8 digits, and configurable periods.
- Low-network mode with fixed RFC 6238 defaults and no web-font downloads.
- Self-contained 1 kB mode using native Web Crypto.
- Plain-text and JSON Worker APIs with content negotiation and body-size limits.
- Direct secret URL compatibility route with explicit privacy warnings.
- RFC 4226, RFC 4648, RFC 6238, route-contract, and security-header tests.
- Cloudflare Worker deployment for `2fa.prasetya.dev`.
- Apache-2.0 project licensing and complete third-party software and font notices.
- Public contribution, security, conduct, CI, Dependabot, issue, and pull-request workflows.

[1.1.0]: https://github.com/andhikapraa/2fa-seeker/releases/tag/v1.1.0
[1.0.0]: https://github.com/andhikapraa/2fa-seeker/releases/tag/v1.0.0
