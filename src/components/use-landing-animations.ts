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
