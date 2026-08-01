# Landing Page Animation Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the anime.js motion layer from the `Landing Page.dc.html` design to the shipped landing page, correct its stale CLI copy, and give the relay diagram a mobile fallback.

**Architecture:** Markup stays declarative React. A single hook, `useLandingAnimations(rootRef)`, owns every anime.js call and finds its targets through `data-lp-*` attributes queried inside a ref'd root. No component imports `animejs`; the hook imports no component. Responsive behavior is Tailwind breakpoints, not the design's JavaScript resize handler.

**Tech Stack:** TanStack Start, React 19, Tailwind v4, anime.js 3.2.2, Biome, `bun test` + Testing Library on happy-dom.

**Spec:** `docs/superpowers/specs/2026-08-02-landing-animation-polish-design.md`

## Global Constraints

- **Bun only.** Never `npm`/`yarn`/`node`. Install with `bun add`.
- **Test-first.** Every task writes a failing test, runs it to confirm failure, then implements. No exceptions.
- **Tests never live in `src/routes/`** — the file router scans that directory. All tests go in `src/components/`.
- **Biome enforces formatting.** Tabs for indent, double quotes. Run `bun run format` before every commit; never hand-fight the formatter.
- **Design tokens only.** Use `text-primary`, `border-border`, `bg-card`, `text-muted-foreground`, `text-fg-subtle`, `text-status-ok`. Do not introduce raw hex values in components. The one exception is `rgba()` inside anime.js keyframe strings, where a CSS variable cannot be interpolated.
- **`--fg-subtle` vs `--status-idle`** are the same hex (`#6a6a70`) but are semantically distinct — `--status-idle` means device health. **New** elements use `text-fg-subtle`. Do **not** retro-fix existing `text-status-idle` usages; that is pre-existing and out of scope.
- **Surgical changes.** Every changed line traces to this plan. Do not reformat, rename, or "improve" adjacent code.
- **Commit trailer** on every commit:
  ```
  Co-authored-by: Claude Opus 5 <noreply@anthropic.com>
  ```
- **`bun run verify`** (Biome → `tsc --noEmit` → `bun test` → build) must pass before the branch is done.

## Attribute contract

The markup tasks (1–4) add these attributes; the motion tasks (5–6) consume them. Adding an attribute before its consumer exists is inert and intentional.

| Attribute | Consumed by | Effect |
|---|---|---|
| `data-lp-hero` | Task 5 | Entrance: opacity + translateY, 90ms stagger |
| `data-lp-aura` | Task 5 | CSS `lpAura` opacity breathe (no JS) |
| `data-lp-pulse` | Task 5 | Status-dot heartbeat `box-shadow` loop |
| `data-lp-reveal` | Task 5 | Scroll reveal via `IntersectionObserver` |
| `data-lp-type` | Task 6 | Typewriter over the attribute's own value — fires when an enclosing `data-lp-reveal` ancestor is revealed, not independently |
| `data-lp-track` + `data-dir` | Task 6 | Ciphertext chips riding a connector |
| `data-lp-cipher` | Task 6 | Glyph churn — what the relay "sees" |
| `data-lp-plain` | Task 6 | Opacity pulse — what the box "reads" |
| `data-lp-step`, `data-lp-open`, `data-lp-lock` | Task 6 | Mobile relay-step cycle |
| `data-lp-diagram`, `data-lp-steps` | Tests only | No motion — test selectors only |

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/links.ts` | *(modify)* Canonical external URLs. Task 1. |
| `src/components/landing-page.tsx` | *(modify)* Page composition: header, hero, why, how, footer. Task 2, 4, 5. |
| `src/components/landing-relay.tsx` | *(create)* The relay section alone: diagram, connectors, mobile steps. Task 3. |
| `src/components/use-landing-animations.ts` | *(create)* Every anime.js call. Tasks 5–6. |
| `src/styles.css` | *(modify)* `@keyframes lpAura` + its reduced-motion opt-out. Task 5. |
| `src/components/landing-page.test.tsx` | *(modify)* Page-level content and behavior. All tasks. |
| `src/components/landing-relay.test.tsx` | *(create)* Relay diagram + mobile list content. Task 3. |

---

### Task 1: Point the install command at get.piperbox.dev

**Files:**
- Modify: `src/lib/links.ts`
- Test: `src/components/landing-page.test.tsx:26-31`, `:74-89`

**Interfaces:**
- Consumes: nothing.
- Produces: `INSTALL_CMD` — value becomes exactly `curl -fsSL https://get.piperbox.dev/install.sh | sh`. Tasks 2 and 5 render it.

> **Risk on record:** neither `get.piperbox.dev` nor `get.openpiper.dev` appears in `piperbox/piper`; its README documents the `raw.githubusercontent.com` URL. If the DNS is not repointed when this ships, the hero CTA is dead. This task is deliberately its own commit so it reverts cleanly.

- [ ] **Step 1: Update the two failing assertions**

In `src/components/landing-page.test.tsx`, replace both occurrences of the old URL. Line 29:

```tsx
	expect(
		screen.getByText("curl -fsSL https://get.piperbox.dev/install.sh | sh"),
	).toBeTruthy();
```

And in the copy-button test, line 85-87:

```tsx
	expect(writeText).toHaveBeenCalledWith(
		"curl -fsSL https://get.piperbox.dev/install.sh | sh",
	);
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test src/components/landing-page.test.tsx
```

Expected: FAIL — 2 failures, "Unable to find an element with the text: curl -fsSL https://get.piperbox.dev/install.sh | sh" and a `toHaveBeenCalledWith` mismatch.

- [ ] **Step 3: Update the constant**

Replace lines 5-7 of `src/lib/links.ts`:

```ts
// NB: get.piperbox.dev must be repointed before this ships — the landing hero
// is the only consumer. See docs/superpowers/specs/2026-08-02-landing-animation-polish-design.md.
export const INSTALL_CMD =
	"curl -fsSL https://get.piperbox.dev/install.sh | sh";
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test src/components/landing-page.test.tsx
```

Expected: PASS — all 9 tests.

- [ ] **Step 5: Commit**

```bash
bun run format && git add src/lib/links.ts src/components/landing-page.test.tsx && git commit -m "$(cat <<'EOF'
feat: point install command at get.piperbox.dev

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Correct the how-it-works copy and add reveal hooks

The shipped page advertises `piper connect`, which is not a real command — `cmd/piper/main.go` in `piperbox/piper` registers `login`, `deploy`, `app`, and `link`. The design's copy matches piper's README quickstart verbatim.

**Files:**
- Modify: `src/components/landing-page.tsx:24-40` (the `steps` array), `:162-189` (`WhySection`), `:242-279` (`HowSection`)
- Test: `src/components/landing-page.test.tsx:40-48`

**Interfaces:**
- Consumes: nothing.
- Produces: `HowSection` renders each step's command inside a `<span data-lp-type="<cmd>">`, which Task 6's typewriter consumes. Section kicker, `<h2>`, cards, and the closing CTA carry `data-lp-reveal`, which Task 5 consumes.

- [ ] **Step 1: Rewrite the failing test**

Replace the existing `"renders the three how-it-works steps with numbers"` test in `src/components/landing-page.test.tsx`:

```tsx
test("renders the three how-it-works steps with real piper commands", async () => {
	await renderLanding();
	expect(screen.getByText("piper login")).toBeTruthy();
	expect(screen.getByText("piper deploy blog --path .")).toBeTruthy();
	expect(screen.getByText("step 01")).toBeTruthy();
	expect(screen.getByText("step 03")).toBeTruthy();
});

test("no step advertises the non-existent piper connect command", async () => {
	await renderLanding();
	expect(screen.queryByText("piper connect")).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test src/components/landing-page.test.tsx
```

Expected: FAIL — "Unable to find an element with the text: piper login", and the `piper connect` test fails because that text is still present.

- [ ] **Step 3: Replace the steps array**

Replace lines 24-40 of `src/components/landing-page.tsx`:

```tsx
const steps = [
	{
		n: "01",
		cmd: "curl -fsSL …/install.sh | sh",
		body: "Installs on a real upgrade channel — apt on Debian/Ubuntu/Raspberry Pi OS, Homebrew on macOS. Verified binaries either way.",
	},
	{
		n: "02",
		cmd: "piper login",
		body: "GitHub sign-in, and it claims this box on the public relay. piperd applies the enrollment itself — no sudo, no restart.",
	},
	{
		n: "03",
		cmd: "piper deploy blog --path .",
		body: "Builds the Dockerfile, health-checks it, and serves it at https://<hash>-<you>.public.getpiper.dev — no port forwarding, no domain required.",
	},
];
```

- [ ] **Step 4: Add reveal + typewriter hooks to HowSection**

In `HowSection`, add `data-lp-reveal` to the kicker `div`, the `<h2>`, each card `div`, the closing `<p>`, and wrap the CTA button. Change the command line inside each card so the command text sits in its own span:

```tsx
						<div className="mb-[10px] text-[13.5px] text-foreground">
							<span className="text-primary">$ </span>
							<span data-lp-type={s.cmd}>{s.cmd}</span>
						</div>
```

The card element becomes:

```tsx
					<div
						key={s.n}
						data-lp-reveal
						className="rounded-[2px] border border-border bg-card p-[22px] transition-colors duration-200 hover:border-primary/40"
					>
```

The kicker, heading, closing paragraph, and CTA wrapper each gain a bare `data-lp-reveal` attribute. Wrap the existing `<CopyInstallButton variant="primary" size="lg" />` in `<span data-lp-reveal>…</span>` so the reveal has an element to animate.

- [ ] **Step 5: Add the same reveal hooks to WhySection**

`WhySection` (lines 162-189) needs identical treatment, or its three cards stay static while every other section animates. Add a bare `data-lp-reveal` to the kicker `div` and the `<h2>`, and change the card element to:

```tsx
					<div
						key={c.title}
						data-lp-reveal
						className="rounded-[2px] border border-border bg-card p-6 text-center transition-colors duration-200 hover:border-primary/40"
					>
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
bun test src/components/landing-page.test.tsx
```

Expected: PASS — 10 tests.

- [ ] **Step 7: Commit**

```bash
bun run format && git add src/components/landing-page.tsx src/components/landing-page.test.tsx && git commit -m "$(cat <<'EOF'
fix: correct landing step copy to real piper commands

piper connect is not a registered command. Match the README quickstart:
install, piper login, piper deploy.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Extract and expand the relay section

The relay section roughly triples: nodes gain payload sub-lines, two animated connector tracks appear, and a four-item mobile list replaces the diagram below `md`. It moves to its own file so `landing-page.tsx` stays under ~350 lines.

**Files:**
- Create: `src/components/landing-relay.tsx`
- Create: `src/components/landing-relay.test.tsx`
- Modify: `src/components/landing-page.tsx` — delete `RelaySection` (lines 191-240), import and render `<LandingRelay />`
- Modify: `src/components/landing-page.test.tsx` — delete the now-moved relay test

**Interfaces:**
- Consumes: nothing.
- Produces: `export function LandingRelay(): JSX.Element` from `src/components/landing-relay.tsx`. Emits `data-lp-track`/`data-dir`, `data-lp-cipher`, `data-lp-plain`, `data-lp-step`, `data-lp-open`, `data-lp-lock`, and `data-lp-reveal` for Tasks 5–6.

> **Watch out:** the string `GET /index.html` appears **twice** in the diagram (the visitor node's payload line and the box node's `reads:` value). Tests must use `getAllByText`, not `getByText`, or they fail on "found multiple elements".

- [ ] **Step 1: Write the failing test**

Create `src/components/landing-relay.test.tsx`:

```tsx
import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { LandingRelay } from "./landing-relay";

test("renders the three diagram node labels", () => {
	render(<LandingRelay />);
	expect(screen.getByText("visitors & cli")).toBeTruthy();
	expect(screen.getByText("piper-relay · cloud")).toBeTruthy();
	expect(screen.getByText("your box · piperd")).toBeTruthy();
});

test("shows the payload each hop can actually see", () => {
	render(<LandingRelay />);
	// The visitor node and the box node both show the plaintext request.
	expect(screen.getAllByText("GET /index.html").length).toBe(2);
	expect(screen.getByText("SNI passthrough — ciphertext only")).toBeTruthy();
	expect(screen.getByText("Docker · Caddy · TLS ends here")).toBeTruthy();
});

test("renders two animated connector tracks with directions", () => {
	const { container } = render(<LandingRelay />);
	const tracks = container.querySelectorAll("[data-lp-track]");
	expect(tracks.length).toBe(2);
	expect(tracks[0]?.getAttribute("data-dir")).toBe("1");
	expect(tracks[1]?.getAttribute("data-dir")).toBe("-1");
});

test("renders the four mobile relay steps, with the last marked open", () => {
	const { container } = render(<LandingRelay />);
	const steps = container.querySelectorAll("[data-lp-step]");
	expect(steps.length).toBe(4);
	expect(screen.getByText("visitor opens https://app.you.dev")).toBeTruthy();
	expect(screen.getByText("TLS terminates on your box")).toBeTruthy();
	// Only the final step ends with TLS open on the box.
	expect(container.querySelectorAll("[data-lp-open]").length).toBe(1);
	expect(steps[3]?.hasAttribute("data-lp-open")).toBe(true);
});

test("diagram and mobile list are mutually exclusive across breakpoints", () => {
	const { container } = render(<LandingRelay />);
	const diagram = container.querySelector("[data-lp-diagram]");
	const steps = container.querySelector("[data-lp-steps]");
	expect(diagram?.className).toContain("hidden");
	expect(diagram?.className).toContain("md:flex");
	expect(steps?.className).toContain("md:hidden");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/components/landing-relay.test.tsx
```

Expected: FAIL — "Cannot find module './landing-relay'".

- [ ] **Step 3: Create the component**

Create `src/components/landing-relay.tsx`:

```tsx
const relaySteps = [
	{
		title: "visitor opens https://app.you.dev",
		body: "TLS handshake starts — destination is your box, not the relay",
		open: false,
	},
	{
		title: "relay reads the SNI and splices bytes",
		body: "L4 passthrough — it never holds a key, never sees plaintext",
		open: false,
	},
	{
		title: "an outbound tunnel carries it home",
		body: "your box dialled out — works behind CGNAT, no ports opened",
		open: false,
	},
	{
		title: "TLS terminates on your box",
		body: "Caddy holds the cert; Docker serves the app",
		open: true,
	},
];

// Wide layout: three nodes separated by two dashed connectors that Task 6
// animates ciphertext chips along. Hidden below md, where RelayStepList
// carries the same story as a vertical list.
function RelayDiagram() {
	return (
		<div
			data-lp-diagram
			className="hidden flex-nowrap items-stretch justify-center text-left md:flex"
		>
			<div className="min-w-0 flex-1 rounded-[2px] border border-border bg-card p-[18px]">
				<div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
					visitors &amp; cli
				</div>
				<div className="text-[13px] text-foreground">https://app.you.dev</div>
				<div className="mt-2.5 text-[11px] text-fg-subtle">GET /index.html</div>
			</div>
			<div className="relative flex min-w-24 flex-[0_0_auto] flex-col items-center justify-center p-3 text-[12px] text-foreground">
				HTTPS →
				<div
					data-lp-track
					data-dir="1"
					className="absolute inset-x-1.5 top-1/2 mt-4 h-px border-t border-dashed border-border"
				/>
			</div>
			<div className="relative min-w-0 flex-[1.15] rounded-[2px] border border-primary bg-primary/[0.07] p-[18px]">
				<div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-primary">
					piper-relay · cloud
				</div>
				<div className="text-[13px] text-foreground">
					SNI passthrough — ciphertext only
				</div>
				<div className="mt-2.5 text-[11px] text-fg-subtle">
					sees:{" "}
					<span data-lp-cipher className="text-muted-foreground">
						░▓▒░ 0x8f2a ▒░▓
					</span>
				</div>
			</div>
			<div className="relative flex min-w-24 flex-[0_0_auto] flex-col items-center justify-center p-3 text-center text-[11px] text-foreground">
				← tunnel
				<span className="mt-[3px] text-fg-subtle">(CGNAT)</span>
				<div
					data-lp-track
					data-dir="-1"
					className="absolute inset-x-1.5 top-1/2 mt-[22px] h-px border-t border-dashed border-border"
				/>
			</div>
			<div className="min-w-0 flex-[1.15] rounded-[2px] border border-border bg-card p-[18px]">
				<div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-status-ok">
					your box · piperd
				</div>
				<div className="text-[13px] text-foreground">
					Docker · Caddy · TLS ends here
				</div>
				<div className="mt-2.5 text-[11px] text-fg-subtle">
					reads:{" "}
					<span data-lp-plain className="text-status-ok">
						GET /index.html
					</span>
				</div>
			</div>
		</div>
	);
}

// Narrow layout: the same four hops as a list. Task 6 cycles the highlight and
// flips the final step's lock glyph from ▣ to ▢ where TLS terminates.
function RelayStepList() {
	return (
		<div data-lp-steps className="flex flex-col gap-2.5 text-left md:hidden">
			{relaySteps.map((s, i) => (
				<div
					key={s.title}
					data-lp-step={i}
					data-lp-open={s.open ? "" : undefined}
					className="flex items-center gap-[14px] rounded-[2px] border border-border bg-card px-4 py-[14px] transition-colors duration-[250ms]"
				>
					<span data-lp-lock className="text-[14px] text-fg-subtle">
						▣
					</span>
					<div>
						<div className="text-[13px]">{s.title}</div>
						<div className="mt-1 text-[11.5px] text-fg-subtle">{s.body}</div>
					</div>
				</div>
			))}
		</div>
	);
}

export function LandingRelay() {
	return (
		<div className="py-16">
			<div className="mb-9 text-center">
				<div
					data-lp-reveal
					className="mb-2 text-[11px] uppercase tracking-[0.16em] text-primary"
				>
					the relay
				</div>
				<h2 data-lp-reveal className="text-[26px] font-semibold">
					Public traffic, private network
				</h2>
				<p
					data-lp-reveal
					className="mx-auto mt-[14px] max-w-[600px] text-sm leading-[1.6] text-muted-foreground text-pretty"
				>
					TLS terminates on your box; the relay splices ciphertext by SNI over an
					outbound tunnel — so it works behind CGNAT and never sees plaintext.
				</p>
			</div>
			<RelayDiagram />
			<RelayStepList />
		</div>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/components/landing-relay.test.tsx
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Swap the old section out of the page**

In `src/components/landing-page.tsx`: delete the whole `RelaySection` function (lines 191-240), add the import at the top:

```tsx
import { LandingRelay } from "@/components/landing-relay";
```

and in `LandingPage`, replace `<RelaySection />` with `<LandingRelay />`.

Then delete the `"renders the relay diagram labels"` test from `src/components/landing-page.test.tsx` — `landing-relay.test.tsx` now owns that coverage.

- [ ] **Step 6: Run the full suite**

```bash
bun test
```

Expected: PASS — every suite green, including the 9 remaining `landing-page.test.tsx` tests.

- [ ] **Step 7: Commit**

```bash
bun run format && git add src/components/landing-relay.tsx src/components/landing-relay.test.tsx src/components/landing-page.tsx src/components/landing-page.test.tsx && git commit -m "$(cat <<'EOF'
feat: extract relay section with payload lines and mobile steps

Nodes now show what each hop can see, connectors become animatable
tracks, and a four-step list carries the story below md.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Tailwind breakpoints for the header, hero, and install bar

The design does this in JavaScript so its canvas can force a mobile frame. We use real breakpoints. Design thresholds map to Tailwind's `md` (768px) and `lg` (1024px).

**Files:**
- Modify: `src/components/landing-page.tsx` — `Header` (79-122), `Hero` (124-160), `LandingPage` (315-331)
- Test: `src/components/landing-page.test.tsx`

**Interfaces:**
- Consumes: `LandingRelay` from Task 3.
- Produces: hero elements carry `data-lp-hero`; the aura div carries `data-lp-aura`; the status dot carries `data-lp-pulse`. Task 5 consumes all three.

- [ ] **Step 1: Write the failing test**

Append to `src/components/landing-page.test.tsx`:

```tsx
test("hero headline scales across breakpoints", async () => {
	await renderLanding();
	const h1 = screen.getByRole("heading", { level: 1 });
	expect(h1.className).toContain("text-[32px]");
	expect(h1.className).toContain("md:text-[42px]");
	expect(h1.className).toContain("lg:text-[52px]");
});

test("hero exposes animation hooks for the motion layer", async () => {
	const { container } = await renderLanding();
	expect(container.querySelectorAll("[data-lp-hero]").length).toBeGreaterThan(0);
	expect(container.querySelector("[data-lp-aura]")).toBeTruthy();
	expect(container.querySelector("[data-lp-pulse]")).toBeTruthy();
});
```

`renderLanding` currently returns nothing. Change its last line to return the render result:

```tsx
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	return render(<RouterProvider router={router as any} />);
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test src/components/landing-page.test.tsx
```

Expected: FAIL — `text-[32px]` not in className, and `[data-lp-aura]` is null.

- [ ] **Step 3: Add breakpoints and hooks to Hero**

Replace the body of `Hero` in `src/components/landing-page.tsx`:

```tsx
function Hero() {
	return (
		<div className="relative pt-[88px] pb-[60px] text-center">
			<div
				data-lp-aura
				className="pointer-events-none absolute inset-x-0 -top-10 h-[420px] animate-[lpAura_11s_ease-in-out_infinite] bg-[radial-gradient(120%_90%_at_50%_-10%,rgba(255,180,84,0.09),transparent_60%)]"
			/>
			<div className="relative">
				<div
					data-lp-hero
					className="mb-[26px] inline-flex items-center gap-2 rounded-full border border-border px-[14px] py-[5px] text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
				>
					<span data-lp-pulse className="h-1.5 w-1.5 rounded-full bg-status-ok" />{" "}
					the paas that runs on hardware you own
				</div>
				<h1
					data-lp-hero
					className="mx-auto max-w-[860px] text-[32px] font-bold leading-[1.1] tracking-[-0.015em] text-balance md:text-[42px] lg:text-[52px]"
				>
					Deploy to your own box
					<br />
					with one <span className="text-primary">git push</span>.
				</h1>
				<p
					data-lp-hero
					className="mx-auto mt-6 max-w-[600px] text-base leading-[1.6] text-muted-foreground text-pretty"
				>
					Open-source, developer-first, zero-trust. Piper turns any box you own
					into a real deploy target with a public HTTPS URL — a cloud VM, an old
					laptop, a home server, even a Raspberry Pi behind CGNAT — without
					exposing your network to anyone, including the relay.
				</p>
				<div data-lp-hero className="mt-[34px] flex justify-center">
					<div className="flex w-full flex-col items-stretch gap-2.5 rounded-[2px] border border-border bg-card px-[14px] py-[11px] text-xs md:inline-flex md:w-auto md:flex-row md:items-center md:gap-3 md:text-[13.5px]">
						<span className="flex min-w-0 max-w-full items-center gap-2.5 overflow-x-auto whitespace-nowrap md:whitespace-normal">
							<span className="text-primary">$</span>
							<span>{INSTALL_CMD}</span>
						</span>
						<CopyInstallButton variant="neutral" size="sm" />
					</div>
				</div>
				<div
					data-lp-hero
					className="mt-4 flex justify-center gap-5 text-[13px] text-muted-foreground"
				>
					<a href={REPO_URL} target="_blank" rel="noreferrer">
						read the docs →
					</a>
					<span className="text-border">|</span>
					<a href={REPO_URL} target="_blank" rel="noreferrer">
						★ star on github
					</a>
				</div>
			</div>
		</div>
	);
}
```

- [ ] **Step 4: Hide the nav below md and tighten page padding**

In `Header`, change the `<nav>` className to `hidden gap-[22px] px-[22px] text-[13px] md:flex`.

In `LandingPage`, change the wrapper to `mx-auto max-w-[1080px] px-[18px] lg:px-6`.

- [ ] **Step 5: Make the copy button full-width on mobile**

In `CopyInstallButton`, pass a className through to `Button`:

```tsx
		<Button
			type="button"
			variant={variant}
			size={size}
			bracketed={false}
			className={variant === "neutral" ? "w-full md:w-auto" : undefined}
			onClick={() => copy(INSTALL_CMD)}
		>
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
bun test src/components/landing-page.test.tsx
```

Expected: PASS — 12 tests.

- [ ] **Step 7: Commit**

```bash
bun run format && git add src/components/landing-page.tsx src/components/landing-page.test.tsx && git commit -m "$(cat <<'EOF'
feat: responsive landing hero and header via Tailwind breakpoints

Replaces the design file's JS resize handler, which existed only so the
design canvas could force a mobile frame.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The core motion layer

**Files:**
- Create: `src/components/use-landing-animations.ts`
- Modify: `src/styles.css` (append)
- Modify: `src/components/landing-page.tsx` — `LandingPage` gets a ref and calls the hook
- Modify: `src/components/landing-page.test.tsx` — `renderLanding` gains a reduced-motion mock
- Modify: `package.json` via `bun add`

**Interfaces:**
- Consumes: `data-lp-hero`, `data-lp-pulse`, `data-lp-reveal` (Tasks 2–4).
- Produces: `export function useLandingAnimations(rootRef: RefObject<HTMLElement | null>): void`. Task 6 extends this same file with relay effects, appending to the module-level `loops` array inside the effect and to its cleanup.

> **Why the test helper changes:** happy-dom's `matchMedia(...).matches` returns `false`, so without a mock the hook runs in every test — setting `opacity: 0` on reveal targets and (after Task 6) blanking `data-lp-type` text. Defaulting `renderLanding()` to reduced motion keeps every content assertion deterministic, and it is a genuine code path rather than a stub.

- [ ] **Step 1: Install anime.js**

```bash
bun add animejs@3.2.2 && bun add -d @types/animejs@3.1.13
```

- [ ] **Step 2: Write the failing tests**

In `src/components/landing-page.test.tsx`, replace the `renderLanding` helper:

```tsx
function mockReducedMotion(reduce: boolean) {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		writable: true,
		value: (query: string) => ({
			matches: reduce && query.includes("prefers-reduced-motion"),
			media: query,
			onchange: null,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false,
		}),
	});
}

// Content assertions run with motion off so the DOM is static: the motion
// layer hides reveal targets and rewrites typewriter text once it engages.
async function renderLanding({ reducedMotion = true } = {}) {
	mockReducedMotion(reducedMotion);
	const rootRoute = createRootRoute({ component: LandingPage });
	const router = createRouter({ routeTree: rootRoute });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	return render(<RouterProvider router={router as any} />);
}
```

Then append:

```tsx
test("reduced motion leaves every reveal target fully visible", async () => {
	const { container } = await renderLanding({ reducedMotion: true });
	const targets = container.querySelectorAll<HTMLElement>(
		"[data-lp-hero], [data-lp-reveal]",
	);
	expect(targets.length).toBeGreaterThan(0);
	for (const el of targets) {
		expect(el.style.opacity).toBe("");
	}
});

test("without reduced motion the hook hides reveal targets to animate them", async () => {
	const { container } = await renderLanding({ reducedMotion: false });
	const targets = container.querySelectorAll<HTMLElement>("[data-lp-reveal]");
	expect(targets.length).toBeGreaterThan(0);
	expect(targets[0]?.style.opacity).toBe("0");
});

test("motion layer mounts and unmounts without throwing", async () => {
	const { unmount } = await renderLanding({ reducedMotion: false });
	expect(() => unmount()).not.toThrow();
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
bun test src/components/landing-page.test.tsx
```

Expected: FAIL — one failure, `"without reduced motion the hook hides reveal targets to animate them"`, with `expected "0", received ""`. No hook exists yet, so nothing sets `opacity`. The other two new tests pass vacuously at this point and become meaningful once Step 4 lands; that is fine, this one is the gate.

- [ ] **Step 4: Write the hook**

Create `src/components/use-landing-animations.ts`:

```ts
import anime from "animejs";
import { type RefObject, useLayoutEffect } from "react";

// anime instances expose more than this, but pausing is all cleanup needs.
type Pausable = { pause: () => void };

/**
 * Owns every anime.js call on the landing page. Targets are found through
 * `data-lp-*` attributes inside `rootRef`, so markup and motion stay decoupled.
 *
 * Runs in useLayoutEffect, not useEffect: the initial opacity:0 must land
 * before first paint. Nothing is hidden in the markup itself, so SSR and no-JS
 * visitors always get a complete page.
 */
export function useLandingAnimations(rootRef: RefObject<HTMLElement | null>) {
	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		// Reduced motion short-circuits everything: nothing hidden, nothing
		// observed, nothing scheduled.
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		const loops: Pausable[] = [];
		let flush: ReturnType<typeof setTimeout> | undefined;

		const hero = root.querySelectorAll<HTMLElement>("[data-lp-hero]");
		for (const el of hero) el.style.opacity = "0";
		anime({
			targets: hero,
			opacity: [0, 1],
			translateY: [16, 0],
			duration: 760,
			delay: anime.stagger(90, { start: 120 }),
			easing: "easeOutCubic",
		});

		const dot = root.querySelector("[data-lp-pulse]");
		if (dot) {
			loops.push(
				anime({
					targets: dot,
					boxShadow: [
						"0 0 0 0 rgba(74,222,128,0.35)",
						"0 0 0 5px rgba(74,222,128,0)",
					],
					duration: 2600,
					easing: "easeOutQuad",
					loop: true,
				}),
			);
		}

		const revealables = root.querySelectorAll<HTMLElement>("[data-lp-reveal]");
		for (const el of revealables) el.style.opacity = "0";
		let batch: HTMLElement[] = [];
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (!e.isIntersecting) continue;
					io.unobserve(e.target);
					batch.push(e.target as HTMLElement);
				}
				if (batch.length === 0) return;
				// Coalesce entries that cross together so one stagger covers them.
				clearTimeout(flush);
				flush = setTimeout(() => {
					const targets = batch;
					batch = [];
					anime({
						targets,
						opacity: [0, 1],
						translateY: [20, 0],
						duration: 680,
						delay: anime.stagger(80),
						easing: "easeOutCubic",
					});
				}, 40);
			},
			{ threshold: 0.25, rootMargin: "0px 0px -8% 0px" },
		);
		for (const el of revealables) io.observe(el);

		return () => {
			io.disconnect();
			clearTimeout(flush);
			for (const l of loops) l.pause();
		};
	}, [rootRef]);
}
```

- [ ] **Step 5: Wire it into the page**

`src/components/landing-page.tsx` already imports `useRef` on line 2 — no import change needed for it. Add the hook import:

```tsx
import { useLandingAnimations } from "@/components/use-landing-animations";
```

and update `LandingPage`:

```tsx
export function LandingPage() {
	const rootRef = useRef<HTMLDivElement>(null);
	useLandingAnimations(rootRef);
	return (
		<div ref={rootRef} className="min-h-screen bg-background">
```

- [ ] **Step 6: Add the aura keyframes**

Append to `src/styles.css`:

```css
@keyframes lpAura {
  0%,
  100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-lp-aura] {
    animation: none;
  }
}
```

- [ ] **Step 7: Run the full suite**

```bash
bun test
```

Expected: PASS — all suites. If `animejs` throws under happy-dom (it uses `document.querySelectorAll` and `getComputedStyle`, both present, so this is unlikely), the contingency is to add `mock.module("animejs", () => ({ default: Object.assign(() => ({ pause() {} }), { stagger: () => 0 }) }))` at the top of `landing-page.test.tsx` — but only after confirming the real failure, never pre-emptively.

- [ ] **Step 8: Commit**

```bash
bun run format && git add -A && git commit -m "$(cat <<'EOF'
feat: add anime.js motion layer for hero and scroll reveals

useLandingAnimations owns every anime.js call and finds targets through
data-lp-* attributes. Reduced motion short-circuits the whole hook, so
nothing is ever left hidden.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Relay and step motion

The effects that carry the zero-trust story: ciphertext chips riding the connectors, glyph churn on what the relay sees, a pulse on what the box reads, typewriter on the step commands, and the mobile step cycle.

**Files:**
- Modify: `src/components/use-landing-animations.ts`
- Modify: `src/components/landing-relay.test.tsx`

**Interfaces:**
- Consumes: `data-lp-type`, `data-lp-track`/`data-dir`, `data-lp-cipher`, `data-lp-plain`, `data-lp-step`/`data-lp-open`/`data-lp-lock` (Tasks 2–3); `loops` and the cleanup function from Task 5.
- Produces: nothing new exported. `useLandingAnimations` keeps the same signature.

> **StrictMode hazard:** the chip effect injects `<span>` elements into each track. React 19 double-invokes effects in development, so cleanup **must** remove them or tracks accumulate chips on every remount. This is a deliberate divergence from the design file, whose `componentWillUnmount` leaks them.

- [ ] **Step 1: Write the failing test**

Append to `src/components/landing-relay.test.tsx` (add `mock` to the `bun:test` import and `useRef` to a new React import):

```tsx
import { useRef } from "react";
import { useLandingAnimations } from "./use-landing-animations";

function mockReducedMotion(reduce: boolean) {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		writable: true,
		value: (query: string) => ({
			matches: reduce && query.includes("prefers-reduced-motion"),
			media: query,
			onchange: null,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false,
		}),
	});
}

function Animated() {
	const ref = useRef<HTMLDivElement>(null);
	useLandingAnimations(ref);
	return (
		<div ref={ref}>
			<LandingRelay />
		</div>
	);
}

test("connector chips are injected on mount and removed on unmount", () => {
	mockReducedMotion(false);
	const { container, unmount } = render(<Animated />);
	const track = container.querySelector("[data-lp-track]");
	expect(track?.childElementCount).toBe(2);
	unmount();
	// Chips must not survive teardown — StrictMode remounts would stack them.
	expect(track?.childElementCount).toBe(0);
});

test("reduced motion injects no chips at all", () => {
	mockReducedMotion(true);
	const { container } = render(<Animated />);
	expect(container.querySelector("[data-lp-track]")?.childElementCount).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/components/landing-relay.test.tsx
```

Expected: FAIL — "expected 2, received 0"; the hook does not touch tracks yet.

- [ ] **Step 3: Add the relay effects to the hook**

In `src/components/use-landing-animations.ts`, add a module-scope helper above the hook:

```ts
const CIPHER_GLYPHS = "░▒▓#$%&/<>*+=";

function typeCommands(els: HTMLElement[]) {
	for (const el of els) {
		for (const t of el.querySelectorAll<HTMLElement>("[data-lp-type]")) {
			const full = t.dataset.lpType ?? "";
			t.textContent = "";
			const o = { i: 0 };
			anime({
				targets: o,
				i: full.length,
				duration: 60 * full.length,
				easing: "linear",
				delay: 260,
				update: () => {
					t.textContent = full.slice(0, Math.round(o.i));
				},
			});
		}
	}
}
```

Call `typeCommands(targets)` inside the reveal `flush` callback, immediately after the `anime({ targets, opacity: … })` call from Task 5.

Then, before the `return () => {…}` cleanup, add:

```ts
		// Ciphertext chips riding each connector. Injected rather than authored
		// in markup so the count stays a motion-layer concern.
		const chips: HTMLElement[] = [];
		root.querySelectorAll<HTMLElement>("[data-lp-track]").forEach((track, ti) => {
			const dir = Number(track.dataset.dir ?? 1);
			const mine: HTMLElement[] = [];
			for (let i = 0; i < 2; i++) {
				const c = document.createElement("span");
				// Inline styles, not Tailwind classes: these nodes are created at
				// runtime and never appear in source, so the scanner cannot see them.
				c.style.cssText =
					"position:absolute;top:-8px;left:0;font-size:10px;letter-spacing:1px;color:color-mix(in srgb, var(--primary) 85%, transparent);opacity:0;white-space:nowrap;pointer-events:none";
				c.textContent = "▓▒░";
				track.appendChild(c);
				mine.push(c);
				chips.push(c);
			}
			const span = () => Math.max(track.offsetWidth - 26, 40);
			loops.push(
				anime({
					targets: mine,
					translateX: dir > 0 ? [0, span] : [span, 0],
					opacity: [
						{ value: 0.95, duration: 220 },
						{ value: 0.95, duration: 1100 },
						{ value: 0, duration: 380 },
					],
					easing: "linear",
					duration: 1900,
					delay: anime.stagger(950, { start: ti * 480 }),
					loop: true,
				}),
			);
		});

		// What the relay sees: never-settling glyphs.
		const cipher = root.querySelector<HTMLElement>("[data-lp-cipher]");
		if (cipher) {
			const o = { t: 0 };
			loops.push(
				anime({
					targets: o,
					t: 1,
					duration: 2200,
					easing: "linear",
					loop: true,
					update: () => {
						let s = "";
						for (let i = 0; i < 16; i++) {
							s += CIPHER_GLYPHS[(i * 5 + Math.floor(o.t * 40)) % CIPHER_GLYPHS.length];
						}
						cipher.textContent = s;
					},
				}),
			);
		}

		// What the box reads: steady plaintext, breathing.
		const plain = root.querySelector("[data-lp-plain]");
		if (plain) {
			loops.push(
				anime({
					targets: plain,
					opacity: [0.45, 1],
					duration: 1900,
					direction: "alternate",
					easing: "easeInOutSine",
					loop: true,
				}),
			);
		}

		// Mobile step cycle. Runs regardless of width — below md the list is the
		// only relay visual, above it the list is display:none and this is inert.
		const stepEls = Array.from(
			root.querySelectorAll<HTMLElement>("[data-lp-step]"),
		);
		let stepTimer: ReturnType<typeof setInterval> | undefined;
		if (stepEls.length > 0) {
			let i = -1;
			const tick = () => {
				i = (i + 1) % stepEls.length;
				stepEls.forEach((s, si) => {
					const on = si === i;
					const open = s.hasAttribute("data-lp-open");
					const accent = open ? "var(--status-ok)" : "var(--primary)";
					s.style.borderColor = on ? accent : "var(--border)";
					s.style.background = on
						? open
							? "rgba(74,222,128,0.06)"
							: "rgba(255,180,84,0.06)"
						: "var(--card)";
					const lock = s.querySelector<HTMLElement>("[data-lp-lock]");
					if (lock) {
						lock.textContent = open ? "▢" : "▣";
						lock.style.color = on ? accent : "var(--fg-subtle)";
					}
				});
			};
			tick();
			stepTimer = setInterval(tick, 2200);
		}
```

Replace the cleanup function with:

```ts
		return () => {
			io.disconnect();
			clearTimeout(flush);
			clearInterval(stepTimer);
			for (const l of loops) l.pause();
			for (const c of chips) c.remove();
		};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test src/components/landing-relay.test.tsx
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Run the full suite**

```bash
bun test
```

Expected: PASS — all suites green.

- [ ] **Step 6: Verify the whole branch**

```bash
bun run verify
```

Expected: Biome clean, `tsc --noEmit` clean, all tests pass, build succeeds.

- [ ] **Step 7: Check it by eye**

```bash
bun run dev
```

At `http://localhost:3000/`, confirm: hero staggers in; the status dot pulses; the aura breathes; cards fade up on scroll; step commands type themselves; chips ride both connectors; the relay's `sees:` churns while the box's `reads:` pulses. Then narrow the window below 768px and confirm the diagram is replaced by the cycling four-step list with its lock glyph flipping to `▢` on the last step. Finally, enable reduced motion (macOS: System Settings → Accessibility → Display → Reduce motion) and reload: the page must be complete and static, with nothing invisible.

- [ ] **Step 8: Commit**

```bash
bun run format && git add -A && git commit -m "$(cat <<'EOF'
feat: animate the relay diagram and how-it-works commands

Ciphertext chips ride both connectors, the relay's view churns while the
box's stays legible, step commands type themselves, and the mobile step
list cycles. Cleanup removes injected chips so StrictMode remounts do
not stack them.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

**Spec coverage.** Install URL → Task 1. Step copy correction → Task 2. Relay payload lines, connector tracks, mobile steps list, relay extraction → Task 3. Tailwind breakpoint table → Task 4. Animation boundary, SSR/`useLayoutEffect`, reduced-motion short-circuit, aura keyframes, cleanup → Task 5. Typewriter, chips, cipher churn, plaintext pulse, mobile cycle → Task 6. Dropped-by-design (`viewport` prop, `scramble()`, `href="#top"`) appear in no task, as intended.

**Known sharp edges, all handled in-plan:** `GET /index.html` renders twice (Task 3 uses `getAllByText`); happy-dom reports no reduced-motion preference (Task 5 mocks `matchMedia` and defaults content tests to reduce); injected chips leak across StrictMode remounts (Task 6 removes them in cleanup); runtime-created chip nodes never appear in source so Tailwind cannot generate classes for them (Task 6 styles them inline).

**Name consistency check.** `useLandingAnimations(rootRef)` — one signature, defined in Task 5, extended in place by Task 6, called only from `LandingPage` (Task 5) and the `Animated` test harness (Task 6). `LandingRelay` — exported by Task 3, imported by Task 3's page edit and Task 6's harness. `INSTALL_CMD` — unchanged name, new value (Task 1), consumed by `Hero` and `CopyInstallButton`. Every `data-lp-*` attribute in the contract table above is produced by Tasks 2–4 and consumed by Tasks 5–6; none is consumed without a producer.
