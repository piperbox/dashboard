# Landing page animation polish

Motion and content pass over the existing public landing page, from the Claude
Design project `Landing page animation polish`
(`915f1546-4d85-4f61-a603-9e581cefb4f3`, file `Landing Page.dc.html`). This is a
**revision of shipped surface**, not new surface: `src/components/landing-page.tsx`
already exists (#51, plan `2026-07-24-landing-page.md`) and renders at `/`.

## Background

The landing page shipped as a static token/primitive mapping of an earlier
mockup — correct palette, correct primitives, zero motion. The new design file
adds an anime.js motion layer and, incidentally, corrects the CLI copy.

Two things in the design file are **design-canvas artifacts**, not intent, and
are deliberately not ported:

- The `viewport` prop (`auto | desktop | mobile`) and its `responsive()` resize
  handler reimplement media queries in JavaScript so the design canvas can force
  a mobile frame. Real breakpoints belong in Tailwind.
- `scramble()` is fully implemented but no element in the markup carries
  `data-lp-scramble`. It is dead on arrival.

A third is a router artifact: the design's sign-in control is `href="#top"`
because the canvas has no router. It stays a `<Link to="/login">`, which
`landing-page.test.tsx` already asserts.

### Content correction

The design's three steps are `piper login` and `piper deploy blog --path .`,
matching piper's own README quickstart verbatim. The shipped page says
`piper connect` / `piper app link myapp --repo owner/name` / `git push`.

`piper connect` **is not a real command** — `cmd/piper/main.go` in
`piperbox/piper` registers `login`, `deploy`, `app`, and `link`. The design is
fixing stale copy, so its wording is authoritative here.

## Scope

**In:** the anime.js motion layer; the corrected step copy; the relay diagram's
new payload sub-lines and animated connectors; a mobile-only relay steps list;
Tailwind-breakpoint responsive behavior; the `INSTALL_CMD` domain change.

**Out:** any change to routing, auth, or the `chrome: false` shell bypass;
restyling beyond what the design file specifies; analytics; OG/SEO; the docs
site; the broader org rename beyond the one install URL below.

## Install URL

`src/lib/links.ts` currently reads:

```
// NB: get.openpiper.dev is live DNS, renamed only once the host is repointed.
export const INSTALL_CMD = "curl -fsSL https://get.openpiper.dev/install.sh | sh";
```

The design hardcodes `get.piperbox.dev`. **Decision: adopt `get.piperbox.dev`**
and update the comment accordingly.

**Recorded risk:** neither host appears anywhere in `piperbox/piper` — its
README and `docs/getting-started.md` document
`https://raw.githubusercontent.com/piperbox/piper/main/install.sh`. If
`get.piperbox.dev` is not repointed by the time this ships, the hero's primary
CTA is a dead URL. Reverting is a one-line change to `links.ts` plus two test
assertions.

## Structure

| File | Change |
|---|---|
| `src/lib/links.ts` | `INSTALL_CMD` domain + comment |
| `src/components/landing-page.tsx` | Corrected step copy, `data-lp-*` hooks, responsive classes, hook wiring |
| `src/components/landing-relay.tsx` | **New.** Diagram, connector tracks, mobile steps list |
| `src/components/use-landing-animations.ts` | **New.** All anime.js orchestration |
| `src/styles.css` | `@keyframes lpAura` |
| `src/components/landing-page.test.tsx` | 2 URL assertions updated, ~5 tests added |
| `src/components/landing-relay.test.tsx` | **New.** Diagram + mobile-list content |
| `package.json` | `animejs@3.2.2` + `@types/animejs` |

The relay section moves to its own file because it roughly triples in size:
the diagram gains payload sub-lines and two animated connector tracks, plus a
four-item mobile list that does not exist today. Inlining it pushes
`landing-page.tsx` past 450 lines. No other section moves.

## The animation boundary

`useLandingAnimations(rootRef)` owns every anime.js call. Components stay
declarative markup. The contract between the two is the `data-lp-*` attribute
set, queried inside the ref'd root:

| Attribute | Effect |
|---|---|
| `data-lp-hero` | Entrance: opacity + translateY, 90ms stagger |
| `data-lp-pulse` | Status-dot heartbeat, `box-shadow` loop |
| `data-lp-reveal` | Scroll reveal via `IntersectionObserver`, batched with stagger |
| `data-lp-type` | Typewriter over the element's own `data-lp-type` value |
| `data-lp-track` + `data-dir` | Ciphertext chips riding a connector, direction-aware |
| `data-lp-cipher` | Glyph churn — what the relay "sees" |
| `data-lp-plain` | Opacity pulse — what the box "reads" |

No component imports `animejs`, and the hook imports no component. The entire
motion layer can be stubbed or deleted without touching markup.

**Cleanup on unmount is total:** `io.disconnect()`, `.pause()` every loop in the
`loops` array, `clearTimeout` on the reveal-batch flush timer. The design's
`componentWillUnmount` is the reference; the hook's cleanup function mirrors it.

## Server rendering and reduced motion

The design sets `opacity: 0` **in JavaScript, never in markup**. That property is
preserved: SSR ships a fully visible page and no-JS visitors see complete
content. The hide-then-animate runs in `useLayoutEffect` rather than
`useEffect`, so the hidden state lands before first paint and there is no
visible flash of content being hidden.

Under `prefers-reduced-motion: reduce`, matching the design: the hero entrance
and scroll reveals still run; every infinite loop (heartbeat, chips, cipher
churn, plaintext pulse) is skipped. The aura's CSS animation is also disabled.
A reduced-motion visitor must never see a blank or partial page.

## Responsive behavior

Tailwind breakpoints replace the design's JavaScript. The design's thresholds
map as follows:

| Design | Tailwind | Behavior |
|---|---|---|
| `< 760px` | below `md` | h1 32px, nav hidden, diagram hidden, steps list shown, install bar stacks with full-width button, padding 18px |
| `760–1000px` | `md` | h1 42px, diagram shown |
| `≥ 1000px` | `lg` | h1 52px, padding 24px |

The diagram and the mobile steps list are mutually exclusive — `hidden md:flex`
and `flex md:hidden` respectively. Both render in the DOM at all widths, so both
are assertable in tests without a viewport mock.

The design cycles the mobile steps on a 2200ms interval, highlighting one at a
time and swapping its lock glyph (`▣` → `▢` on the final "TLS terminates" step).
That cycle is part of the motion layer and lives in the hook, gated on reduced
motion like every other loop.

## Testing

Test-first, per CLAUDE.md. Coverage stops at content and behavior; the anime.js
timeline itself is not asserted — it is visual, and asserting on rAF-driven
inline styles is brittle.

**New:**
- The corrected step commands render (`piper login`,
  `piper deploy blog --path .`).
- The relay payload sub-lines render (`GET /index.html`, the `sees:`/`reads:`
  labels).
- The mobile steps list renders its four items.
- Under `prefers-reduced-motion: reduce`, hero and reveal content is present and
  not left at `opacity: 0`.
- The install-command copy button still round-trips to the clipboard.

**Updated:** the two existing assertions hardcoding
`curl -fsSL https://get.openpiper.dev/install.sh | sh`.

**Unchanged:** the other seven tests in `landing-page.test.tsx` stay green,
including the `/login` and `piperbox/piper` link assertions.

`happy-dom` provides `IntersectionObserver`, `matchMedia`, and
`requestAnimationFrame`, so the hook mounts without a shim. It does **not**
provide `Element.animate` — anime.js does not use it, but any future rewrite of
this layer onto the Web Animations API would need a polyfill in `happydom.ts`.

## Verification

`bun run verify` (Biome → `tsc --noEmit` → `bun test` → build) passes. Beyond
that, the motion layer is checked by eye in `bun run dev` at three widths —
below 760px, between, and above 1000px — plus one pass with reduced motion
forced on.
