# Maintainer guide

This file covers repository settings and release work that cannot be encoded completely in source files.

## Repository profile

Recommended GitHub metadata:

- **Description:** Standards-compliant TOTP generation with explicit local, API-body, and URL credential boundaries.
- **Website:** `https://2fa.prasetya.dev`
- **Topics:** `totp`, `2fa`, `rfc6238`, `cloudflare-workers`, `typescript`, `web-crypto`, `security`, `bun`
- **Social preview:** `docs/assets/totp-generator.png`

## Actions settings

Configure GitHub Actions with:

- Read-only default `GITHUB_TOKEN` permissions.
- Actions cannot create or approve pull requests.
- Approval required before workflows from external contributors run.
- No self-hosted runners for untrusted pull requests.
- Only required, reviewed actions permitted.

The committed CI workflow uses no secrets and pins actions to full commit SHAs.

## Code security settings

Enable before announcing the repository:

- Dependency graph.
- Dependabot alerts and security updates.
- Secret scanning and push protection.
- Private vulnerability reporting.
- CodeQL default setup for JavaScript/TypeScript and GitHub Actions workflows.

Dependabot can propose Bun and GitHub Actions version updates from `.github/dependabot.yml`. Continue running `bun audit` manually during release review because automated security-update coverage for Bun dependencies is incomplete.

## Main branch ruleset

After the initial commit creates `main`, configure a ruleset that:

- Requires pull requests.
- Requires the `Verify` CI job.
- Requires conversation resolution.
- Blocks force pushes and branch deletion.
- Requires CODEOWNERS review when a second trusted reviewer is available.

A solo maintainer cannot provide an independent approval for their own pull request. Do not enable an impossible review requirement before another trusted reviewer exists.

## Deployment policy

Pull-request workflows build and test only. They never receive Cloudflare credentials and never deploy production.

For local or fork deployment:

```bash
bun run deploy:dry
bun run deploy
```

For the official production deployment:

```bash
export CLOUDFLARE_ACCOUNT_ID='...'
wrangler login
bun run deploy:production:dry
bun run deploy:production
```

Use a scoped Cloudflare API token rather than a global API key for non-interactive automation. Do not add production deployment automation until branch protections and environment approvals are in place.

## Release checklist

1. Confirm `main` is green.
2. Run `bun install --frozen-lockfile`.
3. Run `bun run check` and `bun run test`.
4. Review `bun audit`; document any accepted dev-only advisory.
5. Review CodeQL, Dependabot, and secret-scanning alerts.
6. Confirm no `.env*`, `.dev.vars*`, `.wrangler`, `.gstack`, real TOTP material, or internal prompt files are staged.
7. Verify `LICENSE`, `THIRD_PARTY_NOTICES.md`, `public/THIRD_PARTY_NOTICES.txt`, and `public/fonts/LICENSE.txt` are present.
8. Smoke-test `/`, `/slow`, `/1k`, `POST /api/totp`, and the direct plain-text route.
9. Create a signed `v*` tag from protected `main`.
10. Generate release notes and name any accepted security advisory.

## Known development advisory

The current Cloudflare development toolchain brings in `sharp@0.34.5` through Miniflare. GitHub advisory [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) affects Sharp versions before 0.35.0 when processing untrusted images.

This application does not process images and Sharp is not part of the deployed Worker bundle. Keep the advisory visible, avoid untrusted image processing in development tooling, and update when Wrangler/Miniflare adopts a patched Sharp version.
