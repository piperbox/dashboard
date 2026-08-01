import { afterEach, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { LandingRelay } from "./landing-relay";
import { useLandingAnimations } from "./use-landing-animations";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		writable: true,
		value: originalMatchMedia,
	});
});

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
