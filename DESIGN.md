---
name: 2FA TOTP Generator
description: A bold, precise credential instrument for local and API-based TOTP generation.
colors:
  background: "oklch(0.155 0.006 255)"
  surface: "oklch(0.205 0.006 255)"
  cell: "oklch(0.255 0.007 255)"
  cell-highlight: "oklch(0.30 0.008 255)"
  hairline: "oklch(0.34 0.006 255)"
  signal-gold: "oklch(0.845 0.158 92)"
  signal-gold-bright: "oklch(0.9 0.17 96)"
  signal-gold-deep: "oklch(0.72 0.14 90)"
  signal-gold-ink: "oklch(0.22 0.05 95)"
  text: "oklch(0.97 0.004 255)"
  text-dim: "oklch(0.76 0.006 255)"
  text-faint: "oklch(0.645 0.006 255)"
  alert: "oklch(0.64 0.2 26)"
typography:
  headline:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  data:
    fontFamily: "Departure Mono, SFMono-Regular, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  control: "6px"
  panel: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
---

# Design System: 2FA TOTP Generator

## Overview

A single security instrument with an assertive operational hierarchy. The split chassis gives the generated code more visual weight than input, while the valid state activates a restrained gold perimeter and signal rail. Near-black tonal layers and one-pixel divisions preserve calm and credibility.

## Typography

Space Grotesk carries headings, labels, controls, and prose. The two-line task heading uses a committed 3.75rem desktop scale with a tight but readable rhythm. Departure Mono is reserved for the code, timer, standards rail, and parameter telemetry.

## Components

- The brand mark pairs a nine-segment rollover arc with six gold code cells; it appears at 36px in the primary masthead and scales down to a favicon without introducing a security cliché.
- Controls use 6px corners, 44px minimum height, and visible gold focus rings.
- The instrument panel uses an 8px corner, one structural border, and no resting shadow.
- A compact RFC 6238 rail frames the panel as one purpose-built instrument rather than two generic cards.
- Input and result occupy asymmetric 39/61 desktop columns; the result half uses the deepest tonal layer.
- The valid state activates a full gold perimeter, 3px top signal, dominant code well, and primary Copy action.
- The timer bar is 4px high, decorative, and never changes to an alarm color.
- Low-network mode uses native system fonts, a single-column shell, fixed default TOTP parameters, and no decorative assets; it retains the gold action/result signal and explicit credential boundary.
- One-kilobyte mode is a separate austerity surface: system controls, fixed defaults, one inline stylesheet, one inline script, no external resources, and no secondary actions.

## Layout

Input precedes result in the DOM and on mobile. Desktop uses an asymmetric split that makes the generated code the focal point without obscuring the credential boundary. The command-line documentation becomes a quieter editorial two-column section below the instrument. Mobile returns to one column with 16px edge padding and full-width actions.

The `/slow` route is a deliberate fallback, not a reduced-security flow. It remains fully local after its four first-party resources load, supports 320px reflow, and provides explicit links back to the full instrument and the `/1k` austerity route. The `/1k` document keeps its compressed body at or below 1 kB and performs no requests after navigation.

## Motion

Use 150–220ms state transitions only. Align timer updates to wall-clock second boundaries. Under reduced motion, remove smooth timer draining while preserving discrete correctness.

## Prohibitions

No dashboard chrome, nested cards, decorative chips, gradients, glass effects, oversized headlines, urgency effects, third-party-hosted scripts or fonts, additional font families beyond the bundled typefaces, or color-only state communication.
