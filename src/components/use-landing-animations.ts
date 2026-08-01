import anime from "animejs";
import { type RefObject, useLayoutEffect } from "react";

// anime instances expose more than this, but pausing is all cleanup needs.
type Pausable = { pause: () => void };

const CIPHER_GLYPHS = "░▒▓#$%&/<>*+=";

// One-shot typewriter animations: the animated value lives on a plain
// object, not the DOM, so they can't be cancelled via `anime.remove` on an
// element set. Instances are pushed into `loops` so the existing cleanup
// pauses them too, instead of writing to detached nodes after unmount.
function typeCommands(els: HTMLElement[], loops: Pausable[]) {
	for (const el of els) {
		for (const t of el.querySelectorAll<HTMLElement>("[data-lp-type]")) {
			const full = t.dataset.lpType ?? "";
			t.textContent = "";
			const o = { i: 0 };
			loops.push(
				anime({
					targets: o,
					i: full.length,
					duration: 60 * full.length,
					easing: "linear",
					delay: 260,
					update: () => {
						t.textContent = full.slice(0, Math.round(o.i));
					},
				}),
			);
		}
	}
}

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
					typeCommands(targets, loops);
				}, 40);
			},
			{ threshold: 0.25, rootMargin: "0px 0px -8% 0px" },
		);
		for (const el of revealables) io.observe(el);

		// Ciphertext chips riding each connector. Injected rather than authored
		// in markup so the count stays a motion-layer concern.
		const chips: HTMLElement[] = [];
		root
			.querySelectorAll<HTMLElement>("[data-lp-track]")
			.forEach((track, ti) => {
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
							s +=
								CIPHER_GLYPHS[
									(i * 5 + Math.floor(o.t * 40)) % CIPHER_GLYPHS.length
								];
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

		return () => {
			io.disconnect();
			clearTimeout(flush);
			clearInterval(stepTimer);
			for (const l of loops) l.pause();
			for (const c of chips) c.remove();
			anime.remove(hero);
			anime.remove(revealables);
		};
	}, [rootRef]);
}
