import { expect, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { PublicHeader } from "./public-header";

// PublicHeader renders <Link>, which needs a router context to mount.
async function renderHeader(section: string) {
	const rootRoute = createRootRoute({
		component: () => <PublicHeader section={section} />,
	});
	const router = createRouter({ routeTree: rootRoute });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	render(<RouterProvider router={router as any} />);
}

test("shows the section label", async () => {
	await renderHeader("blog");
	expect(screen.getByText("blog")).toBeTruthy();
});

test("links the wordmark home and the dashboard to /apps", async () => {
	await renderHeader("docs");
	expect(screen.getByRole("link", { name: "piper" }).getAttribute("href")).toBe(
		"/",
	);
	expect(
		screen.getByRole("link", { name: "dashboard" }).getAttribute("href"),
	).toBe("/apps");
});

test("links to the piperbox repo", async () => {
	await renderHeader("docs");
	expect(
		screen.getByRole("link", { name: /github/i }).getAttribute("href"),
	).toBe("https://github.com/piperbox/piper");
});
