# Security Policy

## Supported scope

Security fixes target the current `main` branch and the production deployment at [2fa.prasetya.dev](https://2fa.prasetya.dev). Older forks, modified deployments, and unmaintained tags are outside the supported scope.

## Report a vulnerability privately

Use GitHub's private vulnerability reporting flow:

[Open a private vulnerability report](https://github.com/andhikapraa/2fa-seeker/security/advisories/new)

Do not open a public issue for a vulnerability before a fix or disclosure plan is agreed.

Never submit a real TOTP seed, active one-time code, account credential, Cloudflare token, or private key. Use published RFC test vectors and redact unrelated data.

A useful report includes:

- A concise description of the impact.
- The affected route, module, or deployment surface.
- Reproduction steps using test-only data.
- Browser, runtime, and operating-system details when relevant.
- A proposed fix or mitigation, if available.

Reports are handled on a best-effort basis. This project does not currently operate a bug bounty program or promise a response SLA.

## Credential boundaries

| Surface | Credential handling |
| --- | --- |
| Root browser form | Pasted secret is processed locally in the tab |
| `/slow` | Pasted secret is processed locally after first-party assets load |
| `/1k` | Pasted secret is processed locally in one self-contained document |
| `POST /api/totp` | Secret is processed by the Cloudflare Worker from the request body |
| `GET /s/<secret>` | Secret is processed by the Worker and exposed in the URL path; the response is minimal HTML |
| `GET /<secret>` | Secret is processed by the Worker and exposed in the URL path; less private |

The application does not claim zero knowledge or complete erasure. Browser extensions, device compromise, screenshots, clipboard history, shell history, browser history, and Cloudflare's infrastructure remain outside the application's control.

## High-value report areas

- Secret transmission or persistence outside the documented boundaries.
- Incorrect TOTP generation, including defects in its HOTP primitive, or RFC incompatibility.
- Base32 parsing discrepancies that change key material.
- CSP bypasses or unexpected outbound browser requests.
- Cache, referrer, CORS, or response-header regressions.
- Request-size or route handling that enables denial of service.
- Dependency or build-chain compromise with a demonstrated path to contributors or production.

## Public disclosure

Please allow time to investigate, develop a fix, and coordinate disclosure. Credit is offered when requested and when doing so does not expose private information.
