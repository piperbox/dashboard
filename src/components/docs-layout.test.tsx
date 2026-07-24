import { expect, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { DocsLayout } from "./docs-layout";

async function renderLayout(docs: { slug: string; title: string }[]) {
	const rootRoute = createRootRoute({
		component: () => <DocsLayout docs={docs}>body</DocsLayout>,
	});
	const router = createRouter({ routeTree: rootRoute });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	render(<RouterProvider router={router as any} />);
}

test("lists every manifest entry in the sidebar", async () => {
	await renderLayout([
		{ slug: "getting-started", title: "Getting started" },
		{ slug: "custom-domains", title: "Custom domains" },
	]);
	expect(
		screen.getByRole("link", { name: "Getting started" }).getAttribute("href"),
	).toBe("/docs/getting-started");
	expect(screen.getByRole("link", { name: "Custom domains" })).toBeTruthy();
});

test("links to the piperbox repo", async () => {
	await renderLayout([]);
	expect(
		screen.getByRole("link", { name: /github/i }).getAttribute("href"),
	).toBe("https://github.com/piperbox/piper");
});

test("renders its children", async () => {
	await renderLayout([]);
	expect(screen.getByText("body")).toBeTruthy();
});
