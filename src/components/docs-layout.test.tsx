import { expect, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { Section } from "@/lib/docs";
import { DocsLayout } from "./docs-layout";

async function renderLayout(sections: Section[]) {
	const rootRoute = createRootRoute({
		component: () => <DocsLayout sections={sections}>body</DocsLayout>,
	});
	const router = createRouter({ routeTree: rootRoute });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	render(<RouterProvider router={router as any} />);
}

const SECTIONS: Section[] = [
	{
		title: "Guides",
		pages: [
			{ slug: "install", file: "guides/install.md", title: "Install" },
			{ slug: "tui", file: "guides/tui.md", title: "The TUI" },
		],
	},
	{
		title: "Reference",
		pages: [{ slug: "cli", file: "reference/cli.md", title: "CLI" }],
	},
];

test("lists every page under its section header, in manifest order", async () => {
	await renderLayout(SECTIONS);
	const nav = screen.getByRole("navigation", { name: "Documentation" });
	const text = nav.textContent ?? "";
	const order = ["Guides", "Install", "The TUI", "Reference", "CLI"].map((s) =>
		text.indexOf(s),
	);
	expect(order.every((i) => i >= 0)).toBe(true);
	expect([...order].sort((a, b) => a - b)).toEqual(order);
	expect(
		screen.getByRole("link", { name: "Install" }).getAttribute("href"),
	).toBe("/docs/install");
	expect(screen.getByRole("link", { name: "CLI" }).getAttribute("href")).toBe(
		"/docs/cli",
	);
});

test("renders no sidebar when the manifest is empty", async () => {
	await renderLayout([]);
	expect(screen.queryByRole("navigation", { name: "Documentation" })).toBe(
		null,
	);
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
