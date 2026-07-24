import { expect, test } from "bun:test";
import {
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { DocsPage } from "./docs-page";

// DocsPage renders <Link>, which needs a router context to mount.
async function renderDoc(markdown: string) {
	const rootRoute = createRootRoute({
		component: () => <DocsPage markdown={markdown} />,
	});
	const router = createRouter({ routeTree: rootRoute });
	await router.navigate({ to: "/" });
	// biome-ignore lint/suspicious/noExplicitAny: test router typing shortcut
	render(<RouterProvider router={router as any} />);
}

test("renders the document title and prose", async () => {
	await renderDoc("# Getting started\n\nThe full journey.\n");
	expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
		"Getting started",
	);
	expect(screen.getByText("The full journey.")).toBeTruthy();
});

test("gives headings github-compatible anchor ids", async () => {
	await renderDoc("# T\n\n## Box-wide base domain\n");
	expect(screen.getByRole("heading", { level: 2 }).getAttribute("id")).toBe(
		"box-wide-base-domain",
	);
});

test("rewrites markdown links to docs routes", async () => {
	await renderDoc("# T\n\n[getting started](getting-started.md#install)\n");
	expect(
		screen.getByRole("link", { name: "getting started" }).getAttribute("href"),
	).toBe("/docs/getting-started#install");
});

test("renders a bare in-page anchor as a plain anchor, not a router link", async () => {
	await renderDoc("# T\n\n[install](#install)\n");
	expect(
		screen.getByRole("link", { name: "install" }).getAttribute("href"),
	).toBe("#install");
});

test("opens external links in a new tab", async () => {
	await renderDoc("# T\n\n[site](https://example.com)\n");
	const link = screen.getByRole("link", { name: "site" });
	expect(link.getAttribute("target")).toBe("_blank");
	expect(link.getAttribute("rel")).toBe("noreferrer");
});

test("renders fenced code blocks", async () => {
	await renderDoc("# T\n\n```bash\npiper connect\n```\n");
	expect(screen.getByText("piper connect")).toBeTruthy();
});

test("renders gfm tables", async () => {
	await renderDoc(
		"# T\n\n| Feature | State |\n| --- | --- |\n| Relay | ok |\n",
	);
	expect(screen.getByRole("table")).toBeTruthy();
	expect(screen.getByRole("columnheader", { name: "Feature" })).toBeTruthy();
	expect(screen.getByRole("cell", { name: "Relay" })).toBeTruthy();
});

test("lists h2 and h3 headings in the table of contents", async () => {
	await renderDoc("# T\n\n## Install\n\n### Linux\n");
	const toc = screen.getByRole("navigation", { name: "On this page" });
	expect(toc.textContent).toContain("Install");
	expect(toc.textContent).toContain("Linux");
});
