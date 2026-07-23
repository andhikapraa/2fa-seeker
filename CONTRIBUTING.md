# Contributing

Thanks for improving 2FA TOTP Generator. This is a security-sensitive utility, so small, well-tested changes are preferred over broad rewrites.

By submitting a contribution, you agree that it may be distributed under the project's [Apache License 2.0](LICENSE).

## Before opening an issue

- Search existing issues first.
- Use a published RFC test vector, never a real TOTP credential.
- Do not include secrets in URLs, screenshots, recordings, logs, fixtures, commit messages, or reproduction repositories.
- Report security vulnerabilities privately through [SECURITY.md](SECURITY.md).

## Development setup

Install [Bun](https://bun.sh/) 1.3.14 or newer, then install the locked dependencies:

```bash
bun install --frozen-lockfile
```

Run the browser-only Vite development server:

```bash
bun run dev
```

Run the end-to-end Cloudflare Worker surface:

```bash
bun run dev:worker
```

The Worker command builds the static assets before starting Wrangler.

## Verification

Run these checks before opening a pull request:

```bash
bun run check
bun run test
```

`bun run test` builds the production assets and executes the complete Vitest suite. Add or update tests when a change introduces an observable contract or fixes a plausible regression.

Use only the published vectors already represented in `test/` when tests require secret material.

## Pull requests

Keep each pull request focused. Include:

1. What changed and why.
2. Which user-visible or API behavior changed.
3. Whether the credential boundary changed.
4. Exact verification performed.
5. Dependency or deployment changes, if any.

A pull request should not:

- Introduce analytics, telemetry, third-party scripts, or persistent browser storage without prior discussion.
- Weaken CSP, cache, referrer, CORS, or framing protections without a demonstrated requirement.
- Put a secret into a URL when a request body is available.
- Add framework or infrastructure complexity without removing a larger source of complexity.
- Claim zero knowledge, guaranteed privacy, synchronized clocks, or complete erasure.

## Code conventions

- Keep TypeScript strict and allocation-conscious.
- Reuse the shared Base32 and TOTP modules instead of creating a second implementation. The `/1k` page is the deliberate size-constrained exception.
- Preserve leading zeroes in OTP codes.
- Keep input before output in DOM order.
- Maintain keyboard access, visible focus, 320 CSS pixel reflow, and reduced-motion behavior.
- Do not log submitted secrets or echo them in errors.

## Documentation

Update the README or related project documents when changing:

- Public routes or representations.
- Security and credential boundaries.
- Setup, test, or deployment commands.
- Supported algorithms, digits, or periods.
- Low-network or 1 kB payload contracts.

## Dependencies

Discuss new runtime dependencies before adding them. For dependency updates:

```bash
bun install
bun run check
bun run test
bun audit
```

`bun audit` currently reports a high-severity `sharp` advisory inherited through the development-only Wrangler/Miniflare toolchain. The application does not process images and `sharp` is not bundled into the deployed Worker. Do not force an incompatible transitive override; update when the Cloudflare toolchain supports the patched Sharp release.

## Conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
