# 2FA TOTP Generator

## Users

People who already have a Base32 TOTP credential and need the current one-time code in a browser or command line. They may be on a phone or desktop, and they need a fast, explicit credential boundary because the seed is equivalent to an authenticator private credential.

## Product Purpose

Generate standards-compliant TOTP codes from existing Base32 seeds. The root browser flow processes a pasted seed locally without sending it to the Worker. A dedicated `/slow` browser mode keeps the same local-processing boundary with fixed SHA-1, 6-digit, 30-second parameters and no web-font downloads; the full page links to it directly and falls back to it after 10 seconds if the main application does not start. The self-contained `/1k` mode reduces that fixed-parameter flow to one request and a compressed document no larger than 1 kB by using native Web Crypto and omitting secondary controls. The `/s/<secret>` route returns only a large server-generated code in CSS-free HTML and refreshes at the next rollover, but inherits the exposure risks of putting a credential in a URL. A body-based API remains the recommended programmatic surface. The original direct secret URL remains available only as a clearly marked, less-private compatibility shortcut.

## Brand Personality

Precise, restrained, and honest. The interface should feel like a focused security instrument: technically capable, calm under time pressure, and explicit about what the application can and cannot protect.

## Anti-references

- Authenticator clones with playful consumer styling or gamification.
- Generic SaaS dashboards with navigation chrome, nested cards, status chips, and decorative metrics.
- Terminal cosplay that makes a simple task harder to scan.
- Security copy that claims zero knowledge, guaranteed privacy, synchronized clocks, or complete erasure.
- Purple gradients, glassmorphism, neon glow, decorative blur, fake urgency, or countdown alarm effects.

## Design Principles

1. Credential boundaries before convenience. Explain where the seed is processed and distinguish local paste, API body, and URL exposure.
2. One task, one instrument. Keep input, output, timing, and parameters in one stable semantic shell.
3. Standards are visible. Preserve leading zeroes and show the active algorithm, digits, and period.
4. State changes are explicit. Invalid, computing, valid, copied, failed, rolled over, URL-derived, and cleared states must never rely on color alone.
5. Gold is a signal. Reserve the accent for the active primary action and valid generated result.

## Accessibility & Inclusion

Target WCAG 2.2 AA. Support keyboard use, visible focus, 44px touch targets, reduced motion, 320 CSS pixel reflow, 200% text resize, 400% browser zoom, stable labels and descriptions, discrete polite status announcements, and timer semantics that do not announce every second.
