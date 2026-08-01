import { afterEach, expect, mock, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { LandingPage } from "./landing-page";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		writable: true,
		value: originalMatchMedia,
	});
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

// LandingPage renders <Link>, which needs a router context to mount.
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

test("renders the hero headline including the git push accent", async () => {
	await renderLanding();
	const h1 = screen.getByRole("heading", { level: 1 });
	expect(h1.textContent).toContain("Deploy to your own box");
	expect(h1.textContent).toContain("git push");
});

test("shows the install command", async () => {
	await renderLanding();
	expect(
		screen.getByText("curl -fsSL https://get.piperbox.dev/install.sh | sh"),
	).toBeTruthy();
});

test("renders the three why-piper card titles", async () => {
	await renderLanding();
	expect(screen.getByText("Zero-trust relay")).toBeTruthy();
	expect(screen.getByText("Lean by design")).toBeTruthy();
	expect(screen.getByText("Developer-first")).toBeTruthy();
});

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

test("every sign-in link points to /login", async () => {
	await renderLanding();
	const links = screen.getAllByRole("link", { name: /sign in/i });
	expect(links.length).toBeGreaterThan(0);
	for (const link of links) {
		expect(link.getAttribute("href")).toBe("/login");
	}
});

test("docs links point to the piperbox github repo", async () => {
	await renderLanding();
	const links = screen.getAllByRole("link", { name: "docs" });
	expect(links.length).toBeGreaterThan(0);
	for (const link of links) {
		expect(link.getAttribute("href")).toBe("https://github.com/piperbox/piper");
	}
});

test("copy button copies the install command and flips its label", async () => {
	const writeText = mock(() => Promise.resolve());
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText },
		configurable: true,
	});
	await renderLanding();
	const [copyBtn] = screen.getAllByRole("button", {
		name: "copy install command",
	});
	fireEvent.click(copyBtn);
	expect(writeText).toHaveBeenCalledWith(
		"curl -fsSL https://get.piperbox.dev/install.sh | sh",
	);
	expect(await screen.findByText("✓ copied")).toBeTruthy();
});

test("footer renders piperbox github org", async () => {
	await renderLanding();
	expect(
		screen.getByText("Apache-2.0 · runs on a Pi · piperbox/piper"),
	).toBeTruthy();
});

test("hero headline scales across breakpoints", async () => {
	await renderLanding();
	const h1 = screen.getByRole("heading", { level: 1 });
	expect(h1.className).toContain("text-[32px]");
	expect(h1.className).toContain("md:text-[42px]");
	expect(h1.className).toContain("lg:text-[52px]");
});

test("hero exposes animation hooks for the motion layer", async () => {
	const { container } = await renderLanding();
	expect(container.querySelectorAll("[data-lp-hero]").length).toBeGreaterThan(
		0,
	);
	expect(container.querySelector("[data-lp-aura]")).toBeTruthy();
	expect(container.querySelector("[data-lp-pulse]")).toBeTruthy();
});

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
